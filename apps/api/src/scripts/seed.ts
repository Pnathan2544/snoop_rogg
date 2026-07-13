/**
 * Load Generator / Seed Script
 *
 * Sends fake API events to the ingestion endpoint to test the pipeline.
 * Runs for 60 seconds, sending batches every second.
 *
 * Usage:
 *   pnpm --filter @rate-snoop/api seed:smoke
 *   API_URL=http://localhost:3001 TOKEN=your-token PROJECT_ID=uuid pnpm --filter @rate-snoop/api seed:smoke
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.TOKEN || '';
const DURATION_SECONDS = parseInt(process.env.DURATION || '60', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);

const PROVIDERS = ['openai', 'anthropic', 'stripe', 'github', 'sendgrid'];
const ENDPOINTS = [
  '/v1/chat/completions',
  '/v1/messages',
  '/v1/charges',
  '/v1/customers/:id',
  '/repos/:id/commits',
  '/v3/mail/send',
  '/v1/embeddings',
  '/v1/images/generations',
];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStatusCode(): number {
  const rand = Math.random();
  if (rand < 0.70) return 200;
  if (rand < 0.80) return 201;
  if (rand < 0.85) return 400;
  if (rand < 0.90) return 401;
  if (rand < 0.93) return 404;
  if (rand < 0.97) return 429;
  if (rand < 0.98) return 500;
  if (rand < 0.99) return 502;
  return 503;
}

interface FakeEvent {
  eventId?: string;
  provider: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  ts: string;
  rateLimitRemaining?: number;
}

function generateEvent(index: number): FakeEvent {
  const statusCode = generateStatusCode();
  const provider = randomChoice(PROVIDERS);

  return {
    eventId: `evt-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    provider,
    endpoint: randomChoice(ENDPOINTS),
    method: randomChoice(METHODS),
    statusCode,
    latencyMs: randomBetween(50, 2000),
    ts: new Date().toISOString(),
    rateLimitRemaining: Math.random() > 0.3 ? randomBetween(0, 1000) : undefined,
  };
}

async function sendBatch(projectId: string, token: string, batchNum: number): Promise<void> {
  const events = Array.from({ length: BATCH_SIZE }, (_, i) =>
    generateEvent(batchNum * BATCH_SIZE + i),
  );

  try {
    const response = await axios.post(
      `${API_URL}/ingest/events`,
      { events },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      },
    );

    console.log(
      `[Batch ${batchNum}] Sent ${events.length} events - Response: ${JSON.stringify(response.data)}`,
    );
  } catch (error: any) {
    if (error.response) {
      console.error(
        `[Batch ${batchNum}] Error ${error.response.status}: ${JSON.stringify(error.response.data)}`,
      );
    } else {
      console.error(`[Batch ${batchNum}] Network error: ${error.message}`);
    }
  }
}

async function setupProject(): Promise<{ projectId: string; token: string }> {
  console.log('Setting up project...');

  // Create project
  const projectRes = await axios.post(`${API_URL}/projects`, {
    name: `Test Project ${Date.now()}`,
  });
  const projectId: string = projectRes.data.id;
  console.log(`Created project: ${projectId}`);

  // Create token
  const tokenRes = await axios.post(`${API_URL}/projects/${projectId}/tokens`, {
    name: 'Seed Token',
  });
  const token: string = tokenRes.data.token;
  console.log(`Created token: ${token}`);

  return { projectId, token };
}

async function main(): Promise<void> {
  console.log(`Rate Snoop Load Generator`);
  console.log(`API: ${API_URL}`);
  console.log(`Duration: ${DURATION_SECONDS}s, Batch size: ${BATCH_SIZE}`);
  console.log('---');

  let projectId = process.env.PROJECT_ID;
  let token = TOKEN;

  if (!projectId || !token) {
    try {
      const setup = await setupProject();
      projectId = setup.projectId;
      token = setup.token;
    } catch (error: any) {
      console.error('Failed to setup project:', error.message);
      console.error('Make sure the API is running and accessible at', API_URL);
      process.exit(1);
    }
  }

  console.log(`Sending batches for ${DURATION_SECONDS} seconds...`);
  console.log(`Project ID: ${projectId}`);
  console.log('---');

  let batchNum = 0;
  const startTime = Date.now();
  const endTime = startTime + DURATION_SECONDS * 1000;

  const interval = setInterval(async () => {
    if (Date.now() >= endTime) {
      clearInterval(interval);
      console.log('\n---');
      console.log(`Load generation complete! Sent ${batchNum} batches (${batchNum * BATCH_SIZE} events total)`);
      process.exit(0);
    }
    await sendBatch(projectId!, token, batchNum);
    batchNum++;
  }, 1000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(`\nInterrupted after ${batchNum} batches`);
    process.exit(0);
  });
}

main();
