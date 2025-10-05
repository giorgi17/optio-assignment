# Optio Assignment — Single Repo

## Quickstart
```bash
docker compose up --build
```

## Services

API: http://localhost:3000

Frontend: http://localhost:4200 (or served via API proxy if you choose)

RabbitMQ: amqp://localhost:5672

Redis: redis://localhost:6379

Elasticsearch: http://localhost:9200

## Run Demo

Open Frontend → set X, Y → Start.

Watch progress update live; scale workers: docker compose up -d --scale worker=2.

Restart a service; ensure progress resumes and no duplicates appear in ES.