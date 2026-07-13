# Rate Snoop design notes

This document describes the system's actual consistency model and failure boundaries. It is not a claim that the project is production-ready.

## Service responsibilities

| Component | Owns | Does not own |
|---|---|---|
| Next.js dashboard | User interaction and metric visualization | Telemetry persistence |
| NestJS API | Validation, ingest-token authentication, queue admission, metrics reads | Raw-event writes |
| Redis and BullMQ | Job buffering, delivery, retries, failed-job state | Durable analytical storage |
| NestJS worker | Raw persistence, endpoint normalization, aggregation | HTTP ingestion |
| PostgreSQL | Source events, token metadata, aggregate state | Job delivery |

The API and worker are deliberately separate. An API process can accept traffic while worker capacity scales independently.

## Critical invariants

### Accepted is not persisted

`POST /ingest/events` returns `202 Accepted` only after BullMQ accepts the job. PostgreSQL may not contain the event yet. Clients that require synchronous durability would need a different contract.

### Raw events and aggregates change atomically

The worker performs raw insertion and aggregate upserts inside one PostgreSQL transaction. If either step fails, neither change commits.

This prevents the main partial-failure bug in the original implementation: committed raw events with missing aggregates, followed by a retry that could fail on duplicate IDs before repairing those aggregates.

### Only inserted events affect aggregates

The database uniqueness constraint on `(project_id, event_id)` is the concurrency boundary. The worker uses `ON CONFLICT DO NOTHING RETURNING ...` and aggregates only returned rows.

This matters because a read-before-write deduplication check is racy:

1. Worker A checks whether an ID exists and sees nothing.
2. Worker B checks the same ID and also sees nothing.
3. Both attempt insertion.

Letting PostgreSQL arbitrate the conflict makes the decision atomic.

## Delivery semantics

BullMQ jobs can be retried or redelivered. The effective contract is therefore at-least-once processing, not exactly-once execution.

For events with `eventId`, the database constraint plus transactional aggregation produces exactly-once **effects** within a project even though execution can occur more than once.

Events without an ID cannot receive that guarantee. If an acknowledgement is lost after a successful transaction, redelivery creates another raw row and another aggregate contribution.

## Aggregation model

Events are grouped by:

```text
project + minute + provider + normalized endpoint
```

The aggregate stores request count, error count, HTTP 429 count, and average latency. Incremental latency uses a weighted mean:

```text
new_average =
  (old_average × old_count + batch_average × batch_count)
  / (old_count + batch_count)
```

Dashboard combinations across endpoints use request counts as weights. Averaging endpoint averages directly would give a one-request endpoint the same influence as a million-request endpoint.

## Backpressure

Before enqueueing, the API sums waiting, active, and delayed jobs. At 10,000 pending jobs it rejects new work with HTTP 429.

This is useful load shedding, but it is not an atomic global quota. Multiple API replicas can observe the same count and accept work concurrently. Strong admission control would require an atomic Redis operation, BullMQ limiter, or upstream gateway policy.

## Failure matrix

| Failure | Observable effect | Current recovery |
|---|---|---|
| PostgreSQL unavailable | Readiness fails; worker jobs retry | BullMQ exponential retry |
| Redis unavailable | API/worker readiness fails; enqueueing fails | Caller retries after service recovery |
| Worker stops | Jobs remain buffered in Redis | Restart worker |
| Worker transaction fails | No raw or aggregate changes commit | BullMQ retries the job |
| Job exhausts attempts | Job remains in BullMQ's failed set | Manual inspection; no DLQ automation |
| Duplicate `eventId` | Conflicting row is skipped | No aggregate inflation |
| Duplicate without `eventId` | Event may be counted again | No automatic recovery |
| Dashboard unavailable | Ingestion continues | Restart dashboard independently |

## Health semantics

- `/health` and `/health/live` answer whether the process can serve HTTP.
- `/health/ready` checks PostgreSQL and Redis.

A liveness failure should restart a process. A readiness failure should remove it from traffic while dependencies recover. Conflating the two can cause restart storms during an external database outage.

## Scaling and Kubernetes mapping

The service boundaries map naturally onto separate Deployments:

- API replicas scale with request admission load.
- Worker replicas scale with queue depth and processing time.
- Web replicas scale with dashboard traffic.
- PostgreSQL and Redis should generally be managed stateful services.

Queue depth is a useful worker autoscaling signal, but it must be interpreted with processing latency and database capacity. Scaling workers without considering PostgreSQL can merely move the bottleneck downstream.

Kubernetes improves scheduling, recovery, rollout, and scaling. It does not solve idempotency, atomicity, or data-model correctness; those remain application responsibilities.

## Production evolution

A credible next sequence would be:

1. Add user authentication and project authorization.
2. Require or generate stable idempotency keys.
3. Define Redis persistence and acceptable data-loss windows.
4. Add failed-job replay policy and operational alerts.
5. Add aggregate reconciliation from raw events.
6. Partition and retain raw events according to volume and compliance needs.
7. Add rate limiting, TLS, managed secrets, and deployment manifests.
8. Load-test the entire pipeline and size PostgreSQL before autoscaling workers.
