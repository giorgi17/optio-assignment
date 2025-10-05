# Frontend UI (Angular) — Minimal
- Inputs: X, Y (number), Start/Stop buttons
- Status panel: running?, enqueued, processed, rate
- WS client → subscribe `progress` channel; on connect, call `GET /status` for snapshot
- No routing; keep styles minimal.