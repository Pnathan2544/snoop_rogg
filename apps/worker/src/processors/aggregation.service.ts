import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { apiEvents, NewApiEvent } from '@rate-snoop/db';
import type { DrizzleDb } from '@rate-snoop/db';
import { IngestEventDto } from '@rate-snoop/types';
import { sql } from 'drizzle-orm';

interface AggregateKey {
  projectId: string;
  bucketStart: Date;
  provider: string;
  endpointGroup: string;
}

interface AggregateValue {
  requestCount: number;
  errorCount: number;
  count429: number;
  totalLatencyMs: number;
}

type AggregatableEvent = Pick<
  IngestEventDto,
  'provider' | 'endpoint' | 'statusCode' | 'latencyMs'
> & { ts: string | Date };

type DatabaseTransaction = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

/**
 * Normalizes an endpoint path by replacing ID-like segments with :id
 * Examples:
 *   /users/123/posts        -> /users/:id/posts
 *   /v1/customers/cust_abc  -> /v1/customers/:id
 *   /repos/owner/name       -> /repos/owner/name
 */
export function normalizeEndpoint(endpoint: string): string {
  return endpoint
    .split('/')
    .map((segment) => {
      // UUID pattern
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return ':id';
      }
      // Pure numeric
      if (/^\d+$/.test(segment)) {
        return ':id';
      }
      // Stripe-like IDs: prefix_followed_by_alphanumeric_16+ chars
      if (/^[a-z]+_[a-zA-Z0-9]{10,}$/.test(segment)) {
        return ':id';
      }
      // Long hex strings (24+ chars)
      if (/^[a-f0-9]{24,}$/i.test(segment)) {
        return ':id';
      }
      return segment;
    })
    .join('/');
}

/**
 * Floor a date to the nearest minute
 */
export function floorToMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

/**
 * Keep the first occurrence of an event ID within a batch. Events without an
 * ID cannot be safely deduplicated and are therefore retained.
 */
export function deduplicateBatch(events: IngestEventDto[]): IngestEventDto[] {
  const seenEventIds = new Set<string>();

  return events.filter((event) => {
    if (!event.eventId) return true;
    if (seenEventIds.has(event.eventId)) return false;

    seenEventIds.add(event.eventId);
    return true;
  });
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly dbService: DatabaseService) {}

  async processEvents(projectId: string, events: IngestEventDto[]): Promise<void> {
    if (events.length === 0) return;

    const candidateEvents = deduplicateBatch(events);
    const rows: NewApiEvent[] = candidateEvents.map((e) => ({
      projectId,
      eventId: e.eventId ?? null,
      provider: e.provider,
      endpoint: e.endpoint,
      method: e.method,
      statusCode: e.statusCode,
      latencyMs: e.latencyMs,
      ts: new Date(e.ts),
      rateLimitRemaining: e.rateLimitRemaining ?? null,
    }));

    const insertedCount = await this.dbService.db.transaction(async (tx) => {
      const insertedEvents: AggregatableEvent[] = [];
      const chunkSize = 100;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const inserted = await tx
          .insert(apiEvents)
          .values(chunk)
          .onConflictDoNothing()
          .returning({
            provider: apiEvents.provider,
            endpoint: apiEvents.endpoint,
            statusCode: apiEvents.statusCode,
            latencyMs: apiEvents.latencyMs,
            ts: apiEvents.ts,
          });

        insertedEvents.push(...inserted);
      }

      if (insertedEvents.length === 0) return 0;

      await this.upsertAggregates(tx, projectId, insertedEvents);
      return insertedEvents.length;
    });

    const skipped = events.length - insertedCount;
    this.logger.debug(
      `Persisted ${insertedCount} events and skipped ${skipped} duplicates for project ${projectId}`,
    );
  }

  private async upsertAggregates(
    tx: DatabaseTransaction,
    projectId: string,
    events: AggregatableEvent[],
  ): Promise<void> {
    const aggMap = new Map<string, AggregateValue>();
    const keyMap = new Map<string, AggregateKey>();

    for (const event of events) {
      const bucketStart = floorToMinute(new Date(event.ts));
      const endpointGroup = normalizeEndpoint(event.endpoint);
      const key = JSON.stringify([
        projectId,
        bucketStart.toISOString(),
        event.provider,
        endpointGroup,
      ]);

      if (!aggMap.has(key)) {
        aggMap.set(key, {
          requestCount: 0,
          errorCount: 0,
          count429: 0,
          totalLatencyMs: 0,
        });
        keyMap.set(key, {
          projectId,
          bucketStart,
          provider: event.provider,
          endpointGroup,
        });
      }

      const agg = aggMap.get(key)!;
      agg.requestCount++;
      agg.totalLatencyMs += event.latencyMs;
      if (event.statusCode >= 400) agg.errorCount++;
      if (event.statusCode === 429) agg.count429++;
    }

    for (const [key, agg] of aggMap.entries()) {
      const keyData = keyMap.get(key)!;
      const avgLatencyMs = agg.totalLatencyMs / agg.requestCount;

      await tx.execute(sql`
        INSERT INTO minute_aggregates
          (project_id, bucket_start, provider, endpoint_group, request_count, error_count, count_429, avg_latency_ms)
        VALUES (
          ${keyData.projectId}::uuid,
          ${keyData.bucketStart.toISOString()}::timestamptz,
          ${keyData.provider},
          ${keyData.endpointGroup},
          ${agg.requestCount},
          ${agg.errorCount},
          ${agg.count429},
          ${avgLatencyMs}
        )
        ON CONFLICT (project_id, bucket_start, provider, endpoint_group)
        DO UPDATE SET
          request_count = minute_aggregates.request_count + EXCLUDED.request_count,
          error_count   = minute_aggregates.error_count + EXCLUDED.error_count,
          count_429     = minute_aggregates.count_429 + EXCLUDED.count_429,
          avg_latency_ms = (
            minute_aggregates.avg_latency_ms * minute_aggregates.request_count +
            EXCLUDED.avg_latency_ms * EXCLUDED.request_count
          ) / (minute_aggregates.request_count + EXCLUDED.request_count)
      `);
    }

    this.logger.debug(
      `Upserted ${aggMap.size} aggregate buckets for project ${projectId}`,
    );
  }
}
