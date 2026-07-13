import type { IngestEventDto } from '@rate-snoop/types';
import {
  EndpointProfile,
  PROVIDER_PROFILES,
  ProviderProfile,
} from './traffic-profiles';

export type ScenarioName =
  | 'normal'
  | 'bursty'
  | 'rate-limit'
  | 'degraded'
  | 'mixed';

export interface ScenarioEffects {
  label: Exclude<ScenarioName, 'mixed'>;
  trafficMultiplier: number;
  latencyMultiplier: number;
  errorMultiplier: number;
  rateLimitMultiplier: number;
  quotaMultiplier: number;
  degradedProvider?: string;
}

export interface SimulationBatch {
  events: IngestEventDto[];
  baseRequests: number;
  retries: number;
  effects: ScenarioEffects;
}

interface QuotaWindow {
  minute: number;
  remaining: number;
}

const NORMAL_EFFECTS: ScenarioEffects = {
  label: 'normal',
  trafficMultiplier: 1,
  latencyMultiplier: 1,
  errorMultiplier: 1,
  rateLimitMultiplier: 1,
  quotaMultiplier: 1,
};

export function scenarioEffects(
  scenario: ScenarioName,
  elapsedSeconds: number,
): ScenarioEffects {
  if (scenario === 'mixed') {
    const phase = Math.floor(elapsedSeconds / 60) % 4;
    return [
      NORMAL_EFFECTS,
      effectsFor('bursty', true),
      effectsFor('rate-limit', true),
      effectsFor('degraded', true, elapsedSeconds),
    ][phase];
  }

  if (scenario === 'bursty') {
    const burstActive = elapsedSeconds % 75 < 15;
    return effectsFor(scenario, burstActive);
  }

  return effectsFor(scenario, true, elapsedSeconds);
}

function effectsFor(
  scenario: Exclude<ScenarioName, 'mixed'>,
  active: boolean,
  elapsedSeconds = 0,
): ScenarioEffects {
  if (!active || scenario === 'normal') return { ...NORMAL_EFFECTS };

  if (scenario === 'bursty') {
    return {
      label: 'bursty',
      trafficMultiplier: 3.2,
      latencyMultiplier: 1.35,
      errorMultiplier: 1.5,
      rateLimitMultiplier: 2,
      quotaMultiplier: 1,
    };
  }

  if (scenario === 'rate-limit') {
    return {
      label: 'rate-limit',
      trafficMultiplier: 2.1,
      latencyMultiplier: 1.2,
      errorMultiplier: 1.2,
      rateLimitMultiplier: 5,
      quotaMultiplier: 0.25,
    };
  }

  const providerIndex = Math.floor(elapsedSeconds / 60) % PROVIDER_PROFILES.length;
  return {
    label: 'degraded',
    trafficMultiplier: 0.9,
    latencyMultiplier: 1.15,
    errorMultiplier: 1.25,
    rateLimitMultiplier: 1,
    quotaMultiplier: 1,
    degradedProvider: PROVIDER_PROFILES[providerIndex].name,
  };
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  normal(): number {
    const left = Math.max(this.next(), Number.EPSILON);
    const right = Math.max(this.next(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
  }

  weighted<T extends { weight: number }>(items: readonly T[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let cursor = this.next() * total;

    for (const item of items) {
      cursor -= item.weight;
      if (cursor <= 0) return item;
    }

    return items[items.length - 1];
  }
}

export function samplePoisson(random: SeededRandom, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * random.normal()));
  }

  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count++;
    product *= random.next();
  } while (product > limit);
  return count - 1;
}

export class RealtimeTrafficSimulator {
  private readonly random: SeededRandom;
  private readonly quotaWindows = new Map<string, QuotaWindow>();
  private eventCounter = 0;

  constructor(seed: number) {
    this.random = new SeededRandom(seed);
  }

  sampleRequestCount(requestsPerSecond: number, intervalMs: number, effects: ScenarioEffects) {
    const lambda = requestsPerSecond * (intervalMs / 1000) * effects.trafficMultiplier;
    return samplePoisson(this.random, lambda);
  }

  generateBatch(
    baseRequests: number,
    effects: ScenarioEffects,
    nowMs: number,
    intervalMs: number,
  ): SimulationBatch {
    const events: IngestEventDto[] = [];
    let retries = 0;

    for (let index = 0; index < baseRequests; index++) {
      const provider = this.random.weighted(PROVIDER_PROFILES);
      const endpoint = this.random.weighted(provider.endpoints);
      const eventTime = nowMs - Math.floor(this.random.next() * Math.max(1, intervalMs));
      const event = this.generateEvent(provider, endpoint, effects, eventTime);
      events.push(event);

      if (
        (event.statusCode === 429 || event.statusCode >= 500) &&
        this.random.next() < 0.35
      ) {
        events.push(this.generateRetry(event, provider, endpoint, effects, nowMs));
        retries++;
      }
    }

    return { events, baseRequests, retries, effects };
  }

  private generateEvent(
    provider: ProviderProfile,
    endpoint: EndpointProfile,
    effects: ScenarioEffects,
    timestampMs: number,
  ): IngestEventDto {
    const remaining = this.consumeQuota(provider, effects, timestampMs);
    const providerDegraded = effects.degradedProvider === provider.name;
    const rateLimited =
      remaining < 0 ||
      this.random.next() < provider.baseRateLimitRate * effects.rateLimitMultiplier;
    const errorRate =
      provider.baseErrorRate *
      effects.errorMultiplier *
      (providerDegraded ? 9 : 1);

    let statusCode: number;
    if (rateLimited) {
      statusCode = 429;
    } else if (this.random.next() < errorRate) {
      statusCode = this.random.weighted([
        { weight: 28, value: 400 },
        { weight: 12, value: 401 },
        { weight: 16, value: 404 },
        { weight: 22, value: 500 },
        { weight: 13, value: 502 },
        { weight: 9, value: 503 },
      ]).value;
    } else {
      statusCode = endpoint.method === 'POST' && this.random.next() < 0.18 ? 201 : 200;
    }

    const statusLatencyMultiplier =
      statusCode >= 500 ? 2.4 : statusCode === 429 ? 1.45 : statusCode >= 400 ? 1.15 : 1;
    const degradedLatencyMultiplier = providerDegraded ? 2.8 : 1;
    const sampledLatency =
      endpoint.medianLatencyMs *
      Math.exp(endpoint.latencySigma * this.random.normal()) *
      effects.latencyMultiplier *
      degradedLatencyMultiplier *
      statusLatencyMultiplier;

    return {
      eventId: this.nextEventId(timestampMs),
      provider: provider.name,
      endpoint: endpoint.path,
      method: endpoint.method,
      statusCode,
      latencyMs: Math.max(10, Math.min(30_000, Math.round(sampledLatency))),
      ts: new Date(timestampMs).toISOString(),
      rateLimitRemaining: Math.max(0, remaining),
    };
  }

  private generateRetry(
    original: IngestEventDto,
    provider: ProviderProfile,
    endpoint: EndpointProfile,
    effects: ScenarioEffects,
    nowMs: number,
  ): IngestEventDto {
    const retryTime = Math.min(nowMs, Date.parse(original.ts) + 100 + Math.floor(this.random.next() * 800));
    const retry = this.generateEvent(provider, endpoint, effects, retryTime);

    if (original.statusCode >= 500 && retry.statusCode < 400 && this.random.next() < 0.7) {
      retry.statusCode = 200;
      retry.latencyMs = Math.round(retry.latencyMs * 1.15);
    }

    return retry;
  }

  private consumeQuota(
    provider: ProviderProfile,
    effects: ScenarioEffects,
    timestampMs: number,
  ): number {
    const minute = Math.floor(timestampMs / 60_000);
    const quota = Math.max(1, Math.round(provider.requestsPerMinuteQuota * effects.quotaMultiplier));
    const current = this.quotaWindows.get(provider.name);

    if (!current || current.minute !== minute) {
      const next = { minute, remaining: quota - 1 };
      this.quotaWindows.set(provider.name, next);
      return next.remaining;
    }

    current.remaining--;
    return current.remaining;
  }

  private nextEventId(timestampMs: number): string {
    this.eventCounter++;
    const randomPart = Math.floor(this.random.next() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    return `sim-${timestampMs}-${this.eventCounter}-${randomPart}`;
  }
}

