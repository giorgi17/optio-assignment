`/infra/docker-compose.yml` (skeleton)
```yaml
version: "3.9"
services:
  redis:
    image: redis:7
    ports: ["6379:6379"]
  rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.14.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports: ["9200:9200"]
  api:
    build: ./backend/services/api
    depends_on: [redis, rabbitmq, elasticsearch]
    environment:
      - REDIS_URL=redis://redis:6379
      - AMQP_URL=amqp://rabbitmq:5672
      - ES_URL=http://elasticsearch:9200
    ports: ["3000:3000"]
  scheduler:
    build: ./backend/services/scheduler
    depends_on: [redis, rabbitmq]
    environment:
      - REDIS_URL=redis://redis:6379
      - AMQP_URL=amqp://rabbitmq:5672
  worker:
    build: ./backend/services/worker
    depends_on: [rabbitmq, elasticsearch, redis]
    environment:
      - REDIS_URL=redis://redis:6379
      - AMQP_URL=amqp://rabbitmq:5672
      - ES_URL=http://elasticsearch:9200
    
```