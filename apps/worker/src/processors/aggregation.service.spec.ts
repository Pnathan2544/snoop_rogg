import { describe, expect, it } from 'vitest';
import type { IngestEventDto } from '@rate-snoop/types';
import {
  deduplicateBatch,
  floorToMinute,
  normalizeEndpoint,
} from './aggregation.service';

function event(eventId?: string): IngestEventDto {
  return {
    eventId,
    provider: 'openai',
    endpoint: '/v1/chat/completions',
    method: 'POST',
    statusCode: 200,
    latencyMs: 120,
    ts: '2026-07-12T09:41:27.123Z',
  };
}

describe('aggregation helpers', () => {
  it('normalizes ID-like segments without changing stable endpoint names', () => {
    expect(normalizeEndpoint('/users/123/posts')).toBe('/users/:id/posts');
    expect(
      normalizeEndpoint('/users/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/users/:id');
    expect(normalizeEndpoint('/repos/openai/codex')).toBe('/repos/openai/codex');
  });

  it('floors timestamps to the start of a minute', () => {
    expect(floorToMinute(new Date('2026-07-12T09:41:27.123Z')).toISOString()).toBe(
      '2026-07-12T09:41:00.000Z',
    );
  });

  it('keeps one event per eventId while retaining events without IDs', () => {
    const first = event('evt-1');
    const duplicate = { ...event('evt-1'), latencyMs: 999 };
    const withoutIdA = event();
    const withoutIdB = event();

    expect(deduplicateBatch([first, duplicate, withoutIdA, withoutIdB])).toEqual([
      first,
      withoutIdA,
      withoutIdB,
    ]);
  });
});
