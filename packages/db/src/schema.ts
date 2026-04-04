import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  doublePrecision,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================
// projects
// ============================================================
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// ingest_tokens
// ============================================================
export const ingestTokens = pgTable('ingest_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

// ============================================================
// api_events
// ============================================================
export const apiEvents = pgTable(
  'api_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    eventId: text('event_id'),
    provider: text('provider').notNull(),
    endpoint: text('endpoint').notNull(),
    method: text('method').notNull(),
    statusCode: integer('status_code').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    rateLimitRemaining: integer('rate_limit_remaining'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectTsIdx: index('api_events_project_ts_idx').on(table.projectId, table.ts),
    projectProviderTsIdx: index('api_events_project_provider_ts_idx').on(
      table.projectId,
      table.provider,
      table.ts,
    ),
    projectEventIdUniqueIdx: uniqueIndex('api_events_project_event_id_unique_idx')
      .on(table.projectId, table.eventId)
      .where(sql`event_id IS NOT NULL`),
  }),
);

// ============================================================
// minute_aggregates
// ============================================================
export const minuteAggregates = pgTable(
  'minute_aggregates',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
    provider: text('provider').notNull(),
    endpointGroup: text('endpoint_group').notNull(),
    requestCount: integer('request_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    count429: integer('count_429').notNull().default(0),
    avgLatencyMs: doublePrecision('avg_latency_ms').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.projectId, table.bucketStart, table.provider, table.endpointGroup],
    }),
  }),
);

// ============================================================
// Type exports
// ============================================================
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type IngestToken = typeof ingestTokens.$inferSelect;
export type NewIngestToken = typeof ingestTokens.$inferInsert;

export type ApiEvent = typeof apiEvents.$inferSelect;
export type NewApiEvent = typeof apiEvents.$inferInsert;

export type MinuteAggregate = typeof minuteAggregates.$inferSelect;
export type NewMinuteAggregate = typeof minuteAggregates.$inferInsert;
