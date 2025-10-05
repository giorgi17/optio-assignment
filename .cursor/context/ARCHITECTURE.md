# Architecture Overview

**One repo**. Services: `api` (REST+WS), `scheduler`, `worker`. Infra: Redis, RabbitMQ, Elasticsearch.

### Data flow
1) UI calls `POST /run {x,y}` → API stores run-state in Redis and notifies scheduler.
2) Scheduler enqueues `jobId` messages at Y/min to RMQ (durable, persistent).
3) Worker consumes with `prefetch`, writes to ES with `_id=jobId`, `ack` on success.
4) Worker increments Redis counters; API emits WS updates to UI subscribers.

### Idempotency
- `_id=jobId` prevents duplicates in ES.

### Resilience
- Durable queue + persistent messages.
- Clients auto-reconnect; retries with backoff.
- State of truth lives in Redis; API recomputes status on boot.