# Task Plan — Execute in Order

> Cursor: Work through tasks top‑to‑bottom. Do not skip. After each task, run the demo steps and tick acceptance criteria.

## TASK-1: Repo bootstrap ✅
- Create folders: `backend/services/{api,scheduler,worker}`, `frontend`, `infra`.
- Add `docker-compose.yml` (Redis, RabbitMQ, Elasticsearch, optional Kibana).
- Add base `README.md` and `.env.example`.
**Accept:** `docker compose up` starts infra containers healthy.

## TASK-2: Nest workspace & API skeleton ✅
- Create Nest app `api` with endpoints: `POST /run {x,y}`, `POST /stop`, `GET /status`.
- Add WebSocket gateway `/ws` (Socket.IO or WS). Expose `progress` updates.
**Accept:** `GET /status` returns stub; WS connects from a local client.

## TASK-3: Redis state & models
- Add Redis client and keys (`docs/REDIS_KEYS.md`).
- Implement `run` state: `xTotal`, `yMinutes`, `enqueued`, `processed`, `running`.
**Accept:** Setting run updates Redis; `GET /status` reflects it.

## TASK-4: Scheduler loop (rate limit Y/min)
- Implement periodic loop or token-bucket; enqueue jobs with `jobId` to RMQ.
- Use durable queue, message persistence.
**Accept:** With `X=10`, `Y=5`, only ~5 jobs/min reach queue.

## TASK-5: Worker → ES indexing
- Implement RMQ consumer with `prefetch=10`, manual `ack` after successful ES upsert (`_id=jobId`).
- On failure: log, `nack`/retry with small delay.
**Accept:** ES `_count` grows; duplicates don't create multiple docs.

## TASK-6: Progress & WS updates
- Worker increments Redis `processed`. API broadcasts over WS on change.
**Accept:** Frontend sees live `enqueued`/`processed` moving.

## TASK-7: Angular minimal UI
- One page: inputs for X/Y, Start/Stop buttons, current status panel, simple progress bar and rates.
**Accept:** Manual run visible end-to-end.

## TASK-8: Resilience drills
- Restart worker/API while running; verify no data loss, resumed processing, WS recovers.
- Verify API response times < 200ms for GET /status
**Accept:** After restarts, counts continue correctly; no duplicates in ES.

## TASK-9: Scale out
- `docker compose up --scale worker=2`; verify fair consumption (via counts/logs).
**Accept:** Throughput increases; no errors from concurrent workers.

## TASK-10: Polish & Docs
- Fill `docs/ACCEPTANCE_CRITERIA.md`, `docs/ARCHITECTURE.md`, update README with commands and examples.
**Accept:** Reviewer can run and see screenshots / sample curl.
