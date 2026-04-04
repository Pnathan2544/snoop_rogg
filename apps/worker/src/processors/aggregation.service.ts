import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { apiEvents, minuteAggregates, NewApiEvent } from '@rate-snoop/db';
import { IngestEventDto } from '@rate-snoop/types';
import { sql, and, eq, inArray } from 'drizzle-orm';

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

/**
 * Normalizes an endpoint path by replacing ID-like segments with :id
 * Examples:
 *   /users/123/posts        -> /users/:id/posts
 *   /v1/customers/cust_abc  -> /v1/customers/:id
 *   /repos/owner/name       -> /repos/:id/:id  (short non-uuid strings kept)
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

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly dbService: DatabaseService) {}

  async processEvents(projectId: string, events: IngestEventDto[]): Promise<void> {
    if (events.length === 0) return;

    // ---- Step 1: Deduplicate by event_id ----
    const eventsWithId = events.filter((e) => e.eventId);
    let dedupedEvents = events;

    if (eventsWithId.length > 0) {
      const eventIds = eventsWithId.map((e) => e.eventId as string);

      // Check which event_ids already exist
      const existingRows = await this.dbService.db
        .select({ eventId: apiEvents.eventId })
        .from(apiEvents)
        .where(
          and(
            eq(apiEvents.projectId, projectId),
            inArray(apiEvents.eventId, eventIds),
          ),
        );

      const existingEventIds = new Set(existingRows.map((r) => r.eventId));

      dedupedEvents = events.filter(
        (e) => !e.eventId || !existingEventIds.has(e.eventId),
      );

      const skipped = events.length - dedupedEvents.length;
      if (skipped > 0) {
        this.logger.debug(`Deduped ${skipped} events for project ${projectId}`);
      }
    }

    if (dedupedEvents.length === 0) {
      this.logger.debug('All events were duplicates, skipping');
      return;
    }

    // ---- Step 2: Bulk insert raw events ----
    const rows: NewApiEvent[] = dedupedEvents.map((e) => ({
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

    // Insert in chunks of 100 to avoid parameter limit
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await this.dbService.db.insert(apiEvents).values(chunk);
    }

    this.logger.debug(`Inserted ${rows.length} raw events for project ${projectId}`);

    // ---- Step 3: Compute minute aggregates ----
    const aggMap = new Map<string, AggregateValue>();
    const keyMap = new Map<string, AggregateKey>();

    for (const event of dedupedEvents) {
      const bucketStart = floorToMinute(new Date(event.ts));
      const endpointGroup = normalizeEndpoint(event.endpoint);
      const key = `${projectId}|${bucketStart.toISOString()}|${event.provider}|${endpointGroup}`;

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

    // ---- Step 4: UPSERT into minute_aggregates ----
    for (const [key, agg] of aggMap.entries()) {
      const keyData = keyMap.get(key)!;
      const avgLatencyMs = agg.totalLatencyMs / agg.requestCount;

      await this.dbService.db.execute(sql`
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
