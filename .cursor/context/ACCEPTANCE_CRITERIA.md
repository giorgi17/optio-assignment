# Acceptance Criteria (MVP)
- Set X/Y from UI; start/stop a run; see live progress.
- Jobs rate-limited to Y/min, verified by logs and simple timestamps.
- Worker writes to ES with idempotent `_id=jobId`.
- Survives restarts of API/worker without losing work or double-writing.
- Scale worker=2 and observe higher throughput without errors.
- Single command bootstrap via `docker compose up --build`.