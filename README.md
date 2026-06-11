# Rate Snoop - API Rate Monitoring Pipeline

A real-time API rate limit and performance monitoring system. Track request volume, error rates, 429s (rate limits), and latency across your API providers.

11/6/2026 -> I am actively review this project - Nat

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Next.js    │────▶│  NestJS API  │────▶│  BullMQ Queue  │
│  Dashboard  │     │  (ingest +   │     │  (Redis)       │
│  (port 3000)│     │   metrics)   │     └───────┬────────┘
└─────────────┘     │  (port 3001) │             │
                    └──────────────┘             │
                           │                     ▼
                           │             ┌──────────────────┐
                           └────────────▶│  NestJS Worker   │
                                         │  (aggregation)   │
                                         │  (port 3002)     │
                                         └────────┬─────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │   PostgreSQL     │
                                         │  (api_events +   │
                                         │  minute_aggs)    │
                                         └──────────────────┘
```

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### 1. Clone and install

```bash
cd rate_snoop
cp .env.example .env
pnpm install
```

### 2. Start infrastructure (postgres + redis)

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Run database migrations

```bash
# Option A: using psql directly
psql postgresql://postgres:postgres@localhost:5432/rate_snoop \
  -f packages/db/drizzle/0000_initial_schema.sql

# Option B: using drizzle push (pushes schema to db)
pnpm --filter @rate-snoop/db db:push
```

### 4. Start all apps in development mode

```bash
pnpm dev
```

This starts:
- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **Worker**: http://localhost:3002

## Full Stack with Docker

```bash
docker compose up --build
```

All services will start. The web dashboard will be at http://localhost:3000.

## Testing the Pipeline

### Using the seed script

```bash
# Start the seed script (auto-creates a project + token)
pnpm --filter @rate-snoop/api seed

# Or with an existing project
PROJECT_ID=<uuid> TOKEN=<token> pnpm --filter @rate-snoop/api seed
```

### Manual curl example

```bash
# 1. Create a project
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project"}'

# 2. Create an ingest token
curl -X POST http://localhost:3001/projects/<project-id>/tokens \
  -H "Content-Type: application/json" \
  -d '{"name": "Dev Token"}'

# 3. Ingest events (use the token from step 2)
curl -X POST http://localhost:3001/ingest/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "provider": "openai",
      "endpoint": "/v1/chat/completions",
      "method": "POST",
      "statusCode": 200,
      "latencyMs": 450,
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }]
  }'

# 4. Check queue stats
curl http://localhost:3001/ingest/queue-stats

# 5. View metrics
curl "http://localhost:3001/metrics/volume?projectId=<uuid>&from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z"
```

## API Reference

### Ingest API (requires Bearer token auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ingest/events` | Ingest batch of events (max 500) |
| GET | `/ingest/queue-stats` | Queue health stats |

### Projects API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| GET | `/projects/:id/tokens` | List tokens |
| POST | `/projects/:id/tokens` | Create token |

### Metrics API

| Method | Path | Query Params |
|--------|------|-------------|
| GET | `/metrics/volume` | projectId, from, to, provider? |
| GET | `/metrics/errors` | projectId, from, to, provider? |
| GET | `/metrics/latency` | projectId, from, to, provider? |
| GET | `/metrics/top-endpoints` | projectId, from, to, provider? |

## Event Schema

```typescript
{
  eventId?: string;        // Optional: for deduplication
  provider: string;        // e.g. "openai", "stripe", "github"
  endpoint: string;        // e.g. "/v1/chat/completions"
  method: string;          // HTTP method
  statusCode: number;      // HTTP status code (100-599)
  latencyMs: number;       // Response latency in milliseconds
  ts: string;              // ISO 8601 timestamp
  rateLimitRemaining?: number;  // Optional: from rate limit headers
}
```

## Project Structure

```
rate_snoop/
├── apps/
│   ├── api/              NestJS API (ingestion + dashboard reads)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       Token-based authentication
│   │   │   │   ├── ingest/     Event ingestion + BullMQ enqueueing
│   │   │   │   ├── metrics/    Dashboard read APIs
│   │   │   │   └── projects/   Project & token management
│   │   │   └── scripts/
│   │   │       └── seed.ts     Load generator script
│   ├── worker/           NestJS Worker (queue consumer)
│   │   └── src/
│   │       └── processors/
│   │           ├── events.processor.ts    BullMQ processor
│   │           └── aggregation.service.ts  Core aggregation logic
│   └── web/              Next.js 14 App Router frontend
│       └── src/
│           ├── app/      Pages (/, /projects/[id], /projects/[id]/settings)
│           ├── components/charts/  Recharts components
│           └── lib/      API client, utilities
├── packages/
│   ├── db/               Drizzle ORM schema + client
│   └── types/            Shared TypeScript types
├── docker-compose.yml      Full stack
├── docker-compose.dev.yml  Dev infra only
└── turbo.json
```

## Key Implementation Details

### Event Deduplication
Events with an `eventId` are deduplicated: if a `(project_id, event_id)` pair already exists in `api_events`, the event is skipped.

### Endpoint Normalization
Endpoints are normalized before aggregation — path segments that look like IDs (UUIDs, integers, Stripe-format IDs, hex strings) are replaced with `:id`:
- `/users/123/posts` → `/users/:id/posts`
- `/v1/customers/cust_abc123` → `/v1/customers/:id`

### Aggregate UPSERT
Minute aggregates are upserted with a weighted average for latency:
```sql
avg_latency_ms = (old_avg * old_count + new_avg * new_count) / (old_count + new_count)
```

### Auth
Tokens are hashed with SHA-256 (not bcrypt) for fast lookup performance. Raw tokens are only shown once at creation time.

### Queue Backpressure
If the BullMQ queue depth exceeds 10,000 jobs, the ingest endpoint returns HTTP 429.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/rate_snoop` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `3001` / `3002` | App listen port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL for the browser |
