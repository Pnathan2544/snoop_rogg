/**
 * Real-time traffic simulator for dashboard demonstrations.
 *
 * Examples:
 *   pnpm --filter @rate-snoop/api seed:realtime -- --duration 600 --rps 10
 *   pnpm --filter @rate-snoop/api seed:realtime -- --scenario rate-limit --seed 42
 */
import axios from 'axios';
import type { IngestEventDto } from '@rate-snoop/types';
import {
  RealtimeTrafficSimulator,
  ScenarioName,
  scenarioEffects,
} from './traffic-simulator';

const SCENARIOS: readonly ScenarioName[] = [
  'normal',
  'bursty',
  'rate-limit',
  'degraded',
  'mixed',
];

export interface RealtimeSeedOptions {
  apiUrl: string;
  dashboardUrl: string;
  durationSeconds: number;
  requestsPerSecond: number;
  intervalMs: number;
  scenario: ScenarioName;
  seed: number;
  projectId?: string;
  token?: string;
}

interface RunStats {
  accepted: number;
  batches: number;
  retries: number;
  errors: number;
  rateLimited: number;
}

export function parseArguments(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): RealtimeSeedOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument.startsWith('--')) continue;

    const [rawName, inlineValue] = argument.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      values.set(rawName, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      values.set(rawName, next);
      index++;
    } else {
      values.set(rawName, 'true');
    }
  }

  if (values.has('help')) {
    printHelp();
    throw new HelpRequestedError();
  }

  const scenario = (values.get('scenario') ?? env.SCENARIO ?? 'mixed') as ScenarioName;
  if (!SCENARIOS.includes(scenario)) {
    throw new Error(`Unknown scenario "${scenario}". Choose: ${SCENARIOS.join(', ')}`);
  }

  return {
    apiUrl: stripTrailingSlash(values.get('api-url') ?? env.API_URL ?? 'http://localhost:3001'),
    dashboardUrl: stripTrailingSlash(
      values.get('dashboard-url') ?? env.DASHBOARD_URL ?? 'http://localhost:3000',
    ),
    durationSeconds: positiveNumber(
      values.get('duration') ?? env.DURATION ?? '600',
      'duration',
      true,
    ),
    requestsPerSecond: positiveNumber(values.get('rps') ?? env.RPS ?? '10', 'rps'),
    intervalMs: positiveNumber(values.get('interval') ?? env.INTERVAL_MS ?? '1000', 'interval'),
    scenario,
    seed: integer(values.get('seed') ?? env.SEED ?? String(Date.now()), 'seed'),
    projectId: values.get('project-id') ?? env.PROJECT_ID,
    token: values.get('token') ?? env.TOKEN,
  };
}

export async function runRealtimeSeed(options: RealtimeSeedOptions): Promise<RunStats> {
  const { projectId, token } = await resolveProject(options);
  const simulator = new RealtimeTrafficSimulator(options.seed);
  const stats: RunStats = {
    accepted: 0,
    batches: 0,
    retries: 0,
    errors: 0,
    rateLimited: 0,
  };
  let stopping = false;
  let lastLabel = '';

  const stop = () => {
    stopping = true;
    console.log('\nStopping after the active batch...');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const startedAt = Date.now();
  let nextTick = startedAt;

  console.log('Rate Snoop Real-time Traffic Simulator');
  console.log(`Project ID: ${projectId}`);
  console.log(`Dashboard: ${options.dashboardUrl}/projects/${projectId}`);
  console.log(`Scenario: ${options.scenario}`);
  console.log(`Target rate: ${options.requestsPerSecond} requests/s`);
  console.log(`Duration: ${options.durationSeconds === 0 ? 'until interrupted' : `${options.durationSeconds}s`}`);
  console.log(`Random seed: ${options.seed}`);
  console.log('---');

  try {
    while (!stopping) {
      const now = Date.now();
      const elapsedSeconds = (now - startedAt) / 1000;
      if (options.durationSeconds > 0 && elapsedSeconds >= options.durationSeconds) break;

      const effects = scenarioEffects(options.scenario, elapsedSeconds);
      const baseRequests = simulator.sampleRequestCount(
        options.requestsPerSecond,
        options.intervalMs,
        effects,
      );
      const batch = simulator.generateBatch(baseRequests, effects, now, options.intervalMs);

      if (effects.label !== lastLabel) {
        console.log(`[${formatElapsed(elapsedSeconds)}] phase=${effects.label}`);
        lastLabel = effects.label;
      }

      if (batch.events.length > 0) {
        stats.accepted += await sendEvents(options.apiUrl, projectId, token, batch.events);
        stats.batches++;
        stats.retries += batch.retries;
        stats.errors += batch.events.filter((event) => event.statusCode >= 400).length;
        stats.rateLimited += batch.events.filter((event) => event.statusCode === 429).length;
      }

      if (stats.batches > 0 && stats.batches % 10 === 0) {
        console.log(
          `[${formatElapsed(elapsedSeconds)}] accepted=${stats.accepted} errors=${stats.errors} 429s=${stats.rateLimited} retries=${stats.retries}`,
        );
      }

      nextTick += options.intervalMs;
      await sleep(Math.max(0, nextTick - Date.now()));
    }

    console.log('---');
    console.log('Traffic generation complete. Waiting for the worker queue to drain...');
    await waitForQueueDrain(options.apiUrl, token);
    console.log(
      `Accepted ${stats.accepted} events in ${stats.batches} batches; errors=${stats.errors}, 429s=${stats.rateLimited}, retries=${stats.retries}`,
    );
    console.log(`Dashboard: ${options.dashboardUrl}/projects/${projectId}`);
    return stats;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

async function resolveProject(
  options: RealtimeSeedOptions,
): Promise<{ projectId: string; token: string }> {
  if (options.projectId && options.token) {
    return { projectId: options.projectId, token: options.token };
  }

  console.log('Creating a dedicated real-time demo project...');
  const projectResponse = await axios.post(`${options.apiUrl}/projects`, {
    name: `Real-time Demo ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  });
  const projectId = projectResponse.data.id as string;
  const tokenResponse = await axios.post(`${options.apiUrl}/projects/${projectId}/tokens`, {
    name: 'Real-time Simulator',
  });

  return { projectId, token: tokenResponse.data.token as string };
}

async function sendEvents(
  apiUrl: string,
  projectId: string,
  token: string,
  events: IngestEventDto[],
): Promise<number> {
  let accepted = 0;

  for (let offset = 0; offset < events.length; offset += 500) {
    const chunk = events.slice(offset, offset + 500);
    const response = await axios.post(
      `${apiUrl}/ingest/events`,
      { events: chunk },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );
    accepted += Number(response.data.accepted ?? 0);
  }

  return accepted;
}

async function waitForQueueDrain(
  apiUrl: string,
  token: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await axios.get(`${apiUrl}/ingest/queue-stats`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const { waiting, active, delayed, failed } = response.data;
    if (failed > 0) {
      console.warn(`Queue contains ${failed} failed job(s).`);
    }
    if (waiting === 0 && active === 0 && delayed === 0) return;
    await sleep(500);
  }

  console.warn('Queue did not drain before the 30-second timeout.');
}

function positiveNumber(value: string, name: string, allowZero = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`--${name} must be ${allowZero ? 'zero or a positive number' : 'a positive number'}`);
  }
  return parsed;
}

function integer(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`--${name} must be an integer`);
  return parsed;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function printHelp(): void {
  console.log(`Rate Snoop real-time traffic simulator

Options:
  --duration <seconds>   Run time; 0 means until interrupted (default: 600)
  --rps <number>         Baseline requests per second (default: 10)
  --interval <ms>        Batch interval (default: 1000)
  --scenario <name>      normal, bursty, rate-limit, degraded, or mixed
  --seed <integer>       Deterministic random seed
  --api-url <url>        API origin (default: http://localhost:3001)
  --dashboard-url <url>  Dashboard origin (default: http://localhost:3000)
  --project-id <uuid>    Reuse an existing project with --token
  --token <token>        Existing ingest token
  --help                 Show this help`);
}

class HelpRequestedError extends Error {}

async function main(): Promise<void> {
  try {
    const options = parseArguments(process.argv.slice(2));
    await runRealtimeSeed(options);
  } catch (error) {
    if (error instanceof HelpRequestedError) return;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Traffic simulator failed: ${message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
