# Messaging & Elasticsearch Notes

## RabbitMQ
- Queue name: `optio.jobs`
- Durable: true, message persistence enabled
- Consumer: manual `ack`; `prefetch=10`
- Retry: `nack`/requeue on transient errors; dead-letter optional (skip if time tight)

## Elasticsearch
- Index: `optio_jobs`
- Document `_id`: `jobId`
- Mapping: flat fields, e.g. `{ jobId: number, createdAt: date }`