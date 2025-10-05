# Cursor Project Rules — Optio Assignment

> Goal: Minimal, reliable MVP in 10 days. One repo. Single docker-compose. Pipeline = Redis → RabbitMQ → Elasticsearch → WebSocket → Angular.

## Priorities (in order)
1. **Correctness & Resilience (MVP)**: durable queue, ack/prefetch, idempotent ES writes, reconnects.
2. **Simplicity**: smallest working feature set; avoid over-architecture.
3. **Observability-lite**: logs with clear prefixes per service.

## Scope Guardrails (Do / Don’t)
- ✅ Implement exactly: API to set X/Y + start/stop; Scheduler enqueues at Y/min; Worker writes to ES; WS pushes live progress to UI.
- ✅ Multi-instance demo by scaling `worker` in compose; use RMQ `prefetch` and manual `ack`.
- ✅ Store run-state and counters in Redis; UI loads snapshot on refresh.
- ✅ Use one ES index with flat mapping; upsert by `jobId` as `_id`.
- ❌ No Kibana, no complex ES analyzers, no multiple indices.
- ❌ No extra routes/pages in Angular; single-page control + live stats.
- ❌ No non-essential refactors if code already meets acceptance criteria.

## Coding Conventions
- Language: **TypeScript** everywhere. `"strict": true` in tsconfig. Prefer explicit return types. Avoid `any`.
- Errors: bubble to Nest interceptors/filters; include context (service, jobId).
- Logging: `console.log`/Nest logger with prefixes: `[api]`, `[scheduler]`, `[worker]`.
- Env: load from `.env`/compose; do not hardcode credentials.
- Messaging: RMQ queue is **durable**, messages **persistent**, consumers **manual ack**.
- Redis keys: namespaced `optio:*`. Use JSON values (stringified) where structured.
- ES: `index: optio_jobs`. Document idempotency via `_id = jobId`.

## Directory Ownership (Cursor, stick to these)
- `backend/services/api`: REST (set X/Y/start/stop, get status) + WebSocket gateway.
- `backend/services/scheduler`: cron/loop; reads Redis state, enqueues to RMQ at Y/min.
- `backend/services/worker`: RMQ consumer; writes to ES (idempotent), updates Redis counters.
- `frontend`: Angular single-page app. Connects to WS, shows controls & live progress.
- `infra`: compose resources (init scripts optional).

## Design Absolutes
- **Idempotency**: worker uses `jobId` for ES `_id`. Retry-safe.
- **Backpressure**: Scheduler rate-limits; Worker uses `prefetch`.
- **Reconnection**: RMQ/Redis/ES clients auto-retry with backoff.
- **State on refresh**: Frontend fetches snapshot from API on load, then subscribes WS.

## PR/Commit Hygiene
- One cohesive commit per task; include `TASK-#` in message.
- Update `/README.md` and `/docs/ACCEPTANCE_CRITERIA.md` if behavior changes.