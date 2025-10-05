# Optio Assignment — Single Repo

A distributed number processing system with rate-limited scheduling, distributed workers, and real-time progress updates.

## Quickstart
```bash
# Start infrastructure and services
cd infra
docker compose up --build

# Scale workers (optional)
docker compose up -d --scale worker=2
```

## Architecture

- **API** (NestJS): REST endpoints + WebSocket for live progress
- **Scheduler** (NestJS): Rate-limited job enqueuing (Y jobs/min)
- **Worker** (NestJS): Consumes jobs, writes to Elasticsearch
- **Frontend** (Angular): Single-page UI for control and monitoring

## Services

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3000 | REST + WebSocket |
| Frontend | http://localhost:4200 | Angular UI |
| RabbitMQ | amqp://localhost:5672 | Message queue |
| RabbitMQ Management | http://localhost:15672 | Admin UI (guest/guest) |
| Redis | redis://localhost:6379 | State storage |
| Elasticsearch | http://localhost:9200 | Job results storage |

## Environment Variables

Copy the environment template:
```bash
# For local development outside Docker
REDIS_URL=redis://localhost:6379
AMQP_URL=amqp://guest:guest@localhost:5672
ES_URL=http://localhost:9200
PORT=3000
```

## Run Demo

1. Open Frontend at http://localhost:4200
2. Set X (total jobs) and Y (rate per minute)
3. Click **Start** and watch live progress
4. Test scaling: `docker compose up -d --scale worker=2`
5. Test resilience: Restart services and verify no data loss or duplicates

## Development Status

- [x] TASK-1: Infrastructure setup
- [ ] TASK-2: API skeleton
- [ ] TASK-3: Redis state management
- [ ] TASK-4: Scheduler implementation
- [ ] TASK-5: Worker + Elasticsearch
- [ ] TASK-6: WebSocket progress updates
- [ ] TASK-7: Angular UI
- [ ] TASK-8: Resilience testing
- [ ] TASK-9: Horizontal scaling
- [ ] TASK-10: Documentation