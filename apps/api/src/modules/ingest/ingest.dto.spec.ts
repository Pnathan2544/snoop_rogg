import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IngestBatchDto } from './ingest.dto';

const validEvent = {
  eventId: 'evt-1',
  provider: 'openai',
  endpoint: '/v1/chat/completions',
  method: 'POST',
  statusCode: 200,
  latencyMs: 120,
  ts: '2026-07-12T09:41:27.123Z',
};

async function validationErrors(value: unknown) {
  return validate(plainToInstance(IngestBatchDto, value));
}

describe('IngestBatchDto', () => {
  it('accepts a valid event batch', async () => {
    expect(await validationErrors({ events: [validEvent] })).toHaveLength(0);
  });

  it('rejects an empty batch', async () => {
    expect(await validationErrors({ events: [] })).not.toHaveLength(0);
  });

  it('rejects batches larger than 500 events', async () => {
    const events = Array.from({ length: 501 }, () => validEvent);
    expect(await validationErrors({ events })).not.toHaveLength(0);
  });

  it('rejects invalid event fields', async () => {
    const errors = await validationErrors({
      events: [{ ...validEvent, statusCode: 700, latencyMs: -1, ts: 'yesterday' }],
    });
    expect(errors).not.toHaveLength(0);
  });
});
