# Rate Snoop

Rate Snoop is a near-real-time observability pipeline for API traffic. It accepts request telemetry asynchronously and presents request volume, error rate, HTTP 429, latency, and top-endpoint metrics in a Next.js dashboard.

## Architecture

```mermaid
flowchart LR
    Client[Telemetry client] -->|Bearer token + batch| API[NestJS API]
    API -->|Enqueue; HTTP 202| Queue[(BullMQ / Redis)]
    Queue -->|Retryable job| Worker[NestJS worker]
    Worker -->|Atomic insert + aggregate| DB[(PostgreSQL)]
    DB -->|Metrics queries| API
    API -->|JSON| Web[Next.js dashboard]
```

The API does **not** persist accepted events. It validates and enqueues them. The worker owns persistence and minute-level aggregation, so `202 Accepted` means the batch reached Redis, not that it is already visible in PostgreSQL or the dashboard.

See [Design notes](docs/design-notes.md) for invariants, delivery semantics, failure analysis, and scaling trade-offs.

## What is implemented

- Bearer ingest tokens stored as SHA-256 hashes.
- Batch validation for 1–500 events.
- BullMQ jobs with three attempts and exponential backoff.
- Backlog-based admission control at 10,000 pending jobs.
- PostgreSQL raw-event storage and minute aggregates.
- Transactional raw insertion plus aggregate upsert.
- Concurrency-safe deduplication for events carrying `eventId`.
- Endpoint normalization for ID-like path segments.
- Request-weighted latency and error-rate calculations.
- Separate liveness and dependency-aware readiness probes.
- Docker Compose development and complete-stack configurations.
- Provider-aware, deterministic real-time traffic simulation for dashboard demos.
- A root Makefile for setup, development, verification, and operations.
- CI for lint, type-check, tests, builds, container builds, and smoke checks.

## Technology

| Layer | Technology | Responsibility |
|---|---|---|
| Dashboard | Next.js 14, React Query, Recharts | Project management and metrics visualization |
| API | NestJS, class-validator | Authentication, validation, enqueueing, metrics reads |
| Queue | BullMQ 5, Redis | Buffering, retries, distributed job delivery |
| Worker | NestJS, BullMQ WorkerHost | Raw persistence and minute aggregation |
| Database | PostgreSQL, Drizzle ORM | Projects, token hashes, events, aggregates |
| Tooling | GNU Make, pnpm, Turborepo, Docker Compose, Vitest | Workspace orchestration and verification |

## Quick start

### Prerequisites

- Node.js 20+
- Corepack (included with supported Node.js releases)
- Docker with Docker Compose
- GNU Make 4+ (recommended; available through Git Bash, WSL, Scoop, or Chocolatey on Windows)

The Makefile creates a workspace-local pnpm 9 shim, so a global pnpm installation is not required.

### Development mode

```bash
git clone https://github.com/Pnathan2544/snoop_rogg.git
cd snoop_rogg
cp .env.example .env
make install
make dev
```

The development stack exposes:

| Service | Address |
|---|---|
| Dashboard | <http://localhost:3000> |
| API | <http://localhost:3001> |
| Worker probes | <http://localhost:3002/health> |
| PostgreSQL | `localhost:5434` |
| Redis | `localhost:6379` |

For a new PostgreSQL volume, the initial schema is applied automatically from `packages/db/drizzle/0000_initial_schema.sql`.

Stop the development infrastructure with:

```bash
make infra-down
```

### Complete Docker stack

```bash
make stack-up
```

This builds and starts PostgreSQL, Redis, the API, worker, and dashboard. The web service waits for the API readiness probe before starting.

```bash
make stack-down
```

Use `make help` to list all development, stack, database, quality, and traffic commands.

## Generate realistic demo traffic

With the complete Docker stack running:

```bash
make seed
```

The real-time simulator creates a project and token, prints its direct dashboard URL, and produces coherent provider traffic for ten minutes by default. Providers only use their own endpoints and methods. Request arrival follows a jittered distribution, latency is endpoint-specific and skewed, and errors, retries, quotas, and HTTP 429 responses are correlated.

Configure the run with portable Make variables:

```bash
make seed DURATION=600 RPS=12 SCENARIO=normal SEED=42
make seed DURATION=0 RPS=8 SCENARIO=mixed SEED=42
```

`DURATION=0` runs until interrupted. Available scenarios are:

| Scenario | Behavior |
|---|---|
| `normal` | Stable traffic with low baseline errors and rare throttling |
| `bursty` | Short request spikes with elevated latency |
| `rate-limit` | Reduced quotas and sustained throttling |
| `degraded` | Rotating provider latency and 5xx degradation |
| `mixed` | One-minute phases cycling through all behaviors |

For a shorter three-minute dashboard demonstration:

```bash
make seed-fast
```

When running the applications locally instead of in the full Compose stack, use `make seed-local` with the same variables. The simulator waits for the worker queue to drain before exiting. Data becomes visible after the dashboard's next 30-second poll.

The original uniform random generator remains available as a short ingestion smoke test:

```bash
corepack pnpm --filter @rate-snoop/api seed:smoke
```

## Manual ingestion

Create a project:

```bash
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo"}'
```

Create an ingest token using the returned project ID:

```bash
curl -X POST http://localhost:3001/projects/<project-id>/tokens \
  -H "Content-Type: application/json" \
  -d '{"name":"Local client"}'
```

Submit telemetry using the raw token returned at creation:

```bash
curl -X POST http://localhost:3001/ingest/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "eventId": "demo-event-001",
      "provider": "openai",
      "endpoint": "/v1/chat/completions",
      "method": "POST",
      "statusCode": 200,
      "latencyMs": 450,
      "ts": "2026-07-12T09:41:27.123Z"
    }]
  }'
```

`eventId` is optional at validation time but strongly recommended: it is the idempotency key that prevents duplicate delivery from inflating metrics.

## API surface

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/health` | None | Backward-compatible liveness response |
| `GET` | `/health/live` | None | Process liveness |
| `GET` | `/health/ready` | None | PostgreSQL and Redis readiness |
| `GET` | `/projects` | None | List projects |
| `POST` | `/projects` | None | Create a project |
| `GET` | `/projects/:id` | None | Read a project |
| `GET` | `/projects/:id/tokens` | None | List token metadata |
| `POST` | `/projects/:id/tokens` | None | Create an ingest token |
| `POST` | `/ingest/events` | Bearer token | Validate and enqueue 1–500 events |
| `GET` | `/ingest/queue-stats` | Bearer token | Read BullMQ job counts |
| `GET` | `/metrics/volume` | None | Request counts by minute and endpoint |
| `GET` | `/metrics/errors` | None | Errors, 429s, and error rates |
| `GET` | `/metrics/latency` | None | Weighted-latency inputs |
| `GET` | `/metrics/top-endpoints` | None | Top 20 endpoints for a time range |

Metrics routes require `projectId`, ISO-8601 `from`, and ISO-8601 `to`. Reversed time ranges are rejected. `provider` is optional.

Project management and metrics reads are intentionally unauthenticated in this local demonstration. Do not expose the API publicly without user authentication and project-level authorization.

## Event contract

```json
{
  "eventId": "provider-request-id",
  "provider": "openai",
  "endpoint": "/v1/chat/completions",
  "method": "POST",
  "statusCode": 200,
  "latencyMs": 450,
  "ts": "2026-07-12T09:41:27.123Z",
  "rateLimitRemaining": 987
}
```

| Field | Validation |
|---|---|
| `eventId` | Optional string; recommended for retry safety |
| `provider` | Non-empty string |
| `endpoint` | Non-empty string |
| `method` | Non-empty string |
| `statusCode` | Integer from 100 through 599 |
| `latencyMs` | Non-negative integer |
| `ts` | ISO-8601 timestamp |
| `rateLimitRemaining` | Optional non-negative integer |

## Verification

Run the same quality gates used before container smoke tests:

```bash
pnpm verify
```

Or run them independently:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

## Repository structure

```text
apps/
  api/       NestJS ingestion, project, token, metrics, and probe endpoints
  worker/    BullMQ consumer and transactional aggregation
  web/       Next.js dashboard
packages/
  db/        Drizzle schema, SQL migration, and database client
  types/     Shared wire contracts
docs/
  design-notes.md
```

## Current boundaries

- No end-user authentication or project-level authorization.
- No separate dead-letter queue or automated failed-job replay policy.
- Backpressure is an approximate admission check, not an atomic distributed quota.
- Events without `eventId` are not idempotent under redelivery.
- No retention, partitioning, reconciliation, or long-term capacity policy.
- Production Redis durability, TLS, secrets, and deployment manifests are out of scope.

These limitations are explicit because reliability claims are only useful when their boundary conditions are visible.
