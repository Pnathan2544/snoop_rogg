-- Rate Snoop initial schema migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- projects
-- ============================================================
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- ingest_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS "ingest_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_used_at" timestamptz
);

-- ============================================================
-- api_events
-- ============================================================
CREATE TABLE IF NOT EXISTS "api_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "event_id" text,
  "provider" text NOT NULL,
  "endpoint" text NOT NULL,
  "method" text NOT NULL,
  "status_code" integer NOT NULL,
  "latency_ms" integer NOT NULL,
  "ts" timestamptz NOT NULL,
  "rate_limit_remaining" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Indexes for api_events
CREATE INDEX IF NOT EXISTS "api_events_project_ts_idx"
  ON "api_events" ("project_id", "ts" DESC);

CREATE INDEX IF NOT EXISTS "api_events_project_provider_ts_idx"
  ON "api_events" ("project_id", "provider", "ts" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "api_events_project_event_id_unique_idx"
  ON "api_events" ("project_id", "event_id")
  WHERE event_id IS NOT NULL;

-- ============================================================
-- minute_aggregates
-- ============================================================
CREATE TABLE IF NOT EXISTS "minute_aggregates" (
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "bucket_start" timestamptz NOT NULL,
  "provider" text NOT NULL,
  "endpoint_group" text NOT NULL,
  "request_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0,
  "count_429" integer NOT NULL DEFAULT 0,
  "avg_latency_ms" double precision NOT NULL DEFAULT 0,
  PRIMARY KEY ("project_id", "bucket_start", "provider", "endpoint_group")
);
