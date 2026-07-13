import { describe, expect, it } from 'vitest';
import { PROVIDER_PROFILES } from './traffic-profiles';
import {
  RealtimeTrafficSimulator,
  SeededRandom,
  samplePoisson,
  scenarioEffects,
} from './traffic-simulator';

describe('RealtimeTrafficSimulator', () => {
  it('is reproducible for a fixed seed and clock', () => {
    const left = new RealtimeTrafficSimulator(42);
    const right = new RealtimeTrafficSimulator(42);
    const effects = scenarioEffects('normal', 0);

    expect(left.generateBatch(100, effects, 1_720_000_000_000, 1000)).toEqual(
      right.generateBatch(100, effects, 1_720_000_000_000, 1000),
    );
  });

  it('only emits valid endpoint and method combinations for each provider', () => {
    const simulator = new RealtimeTrafficSimulator(7);
    const batch = simulator.generateBatch(
      600,
      scenarioEffects('normal', 0),
      1_720_000_000_000,
      1000,
    );
    const validRoutes = new Map(
      PROVIDER_PROFILES.map((provider) => [
        provider.name,
        new Set(provider.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)),
      ]),
    );

    for (const event of batch.events) {
      expect(validRoutes.get(event.provider)?.has(`${event.method} ${event.endpoint}`)).toBe(true);
    }
  });

  it('keeps normal traffic errors low and latency within a plausible range', () => {
    const simulator = new RealtimeTrafficSimulator(99);
    const batch = simulator.generateBatch(
      600,
      scenarioEffects('normal', 0),
      1_720_000_000_000,
      1000,
    );
    const errors = batch.events.filter((event) => event.statusCode >= 400);
    const rateLimited = batch.events.filter((event) => event.statusCode === 429);
    const averageLatency =
      batch.events.reduce((sum, event) => sum + event.latencyMs, 0) / batch.events.length;

    expect(errors.length / batch.events.length).toBeLessThan(0.05);
    expect(rateLimited.length / batch.events.length).toBeLessThan(0.02);
    expect(averageLatency).toBeGreaterThan(150);
    expect(averageLatency).toBeLessThan(1500);
  });

  it('creates visibly more throttling in the rate-limit scenario', () => {
    const timestamp = 1_720_000_000_000;
    const normalBatch = new RealtimeTrafficSimulator(123).generateBatch(
      600,
      scenarioEffects('normal', 0),
      timestamp,
      1000,
    );
    const limitedBatch = new RealtimeTrafficSimulator(123).generateBatch(
      600,
      scenarioEffects('rate-limit', 0),
      timestamp,
      1000,
    );
    const normal429s = normalBatch.events.filter((event) => event.statusCode === 429).length;
    const limited429s = limitedBatch.events.filter((event) => event.statusCode === 429).length;

    expect(limited429s).toBeGreaterThan(normal429s * 5);
    expect(limited429s).toBeGreaterThan(100);
  });

  it('places real-time events inside the current emission interval', () => {
    const now = 1_720_000_000_000;
    const interval = 1000;
    const batch = new RealtimeTrafficSimulator(25).generateBatch(
      100,
      scenarioEffects('normal', 0),
      now,
      interval,
    );

    for (const event of batch.events) {
      const timestamp = Date.parse(event.ts);
      expect(timestamp).toBeGreaterThan(now - interval - 1);
      expect(timestamp).toBeLessThanOrEqual(now);
    }
  });

  it('uses deterministic Poisson sampling', () => {
    const left = new SeededRandom(88);
    const right = new SeededRandom(88);

    expect(Array.from({ length: 20 }, () => samplePoisson(left, 10))).toEqual(
      Array.from({ length: 20 }, () => samplePoisson(right, 10)),
    );
  });

  it('cycles the mixed scenario once per minute', () => {
    expect(scenarioEffects('mixed', 0).label).toBe('normal');
    expect(scenarioEffects('mixed', 60).label).toBe('bursty');
    expect(scenarioEffects('mixed', 120).label).toBe('rate-limit');
    expect(scenarioEffects('mixed', 180).label).toBe('degraded');
    expect(scenarioEffects('mixed', 240).label).toBe('normal');
  });
});

