# Redis Keys & Channels

## Keys (Persistent Data)
- `optio:run`: JSON `{ running, xTotal, yMinutes, enqueued, processed, startedAt }`
  - `xTotal`: Total number of jobs to process
  - `yMinutes`: Duration in minutes to process X jobs (Rate = X/Y jobs per minute)
  - `enqueued`: Number of jobs enqueued to RabbitMQ so far
  - `processed`: Number of jobs completed by workers
- `optio:queue:nextId`: integer counter for assigning `jobId` if needed
- `optio:metrics:timestamps`: optional list for quick rate checks (trimmed)

## Channels (Pub/Sub - Ephemeral)
- `optio:progress`: Progress update broadcasts
  - Published by: Worker (on every job processed), Scheduler (every 10 jobs enqueued)
  - Subscribed by: API service
  - Payload: JSON `RunState` (same structure as `optio:run`)
  - Purpose: Real-time WebSocket updates without polling