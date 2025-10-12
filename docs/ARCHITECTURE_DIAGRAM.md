I'll create a visual diagram for you. Let me make a comprehensive one showing all the components and data flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                                 │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  ANGULAR FRONTEND (http://localhost:4200)                │           │
│  │  ┌────────────────────────────────────────────────────┐  │           │
│  │  │  UI: Input X=1000, Y=10  [Start] [Stop]           │  │           │
│  │  │  Progress Bar: ████░░░░░░ 45/1000 (4.5%)          │  │           │
│  │  │  Status: Running | Rate: 10/min                    │  │           │
│  │  └────────────────────────────────────────────────────┘  │           │
│  └──────────────────────────────────────────────────────────┘           │
│           │                                    ▲                          │
│           │ HTTP POST /run {x,y}               │ WebSocket                │
│           │ HTTP GET /status                   │ (live updates)           │
│           ▼                                    │                          │
└───────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    NESTJS API SERVICE (:3000)                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  @Controller('/')                                               │    │
│  │  • POST /run    → stores {x, y, running, processed} to Redis  │    │
│  │  • POST /stop   → sets running=false in Redis                  │    │
│  │  • GET /status  → reads current state from Redis               │    │
│  │                                                                 │    │
│  │  @WebSocketGateway()                                            │    │
│  │  • Monitors Redis for changes                                  │    │
│  │  • Broadcasts: {enqueued: 500, processed: 45}                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│           │                                                              │
│           │ Reads/Writes                                                │
│           ▼                                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       REDIS (:6379)                                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Key: optio:run                                                │    │
│  │  Value: {                                                       │    │
│  │    xTotal: 1000,        ← Total jobs requested                │    │
│  │    yPerMinute: 10,      ← Rate limit                           │    │
│  │    enqueued: 500,       ← Jobs pushed to queue so far         │    │
│  │    processed: 45,       ← Jobs completed by workers           │    │
│  │    running: true        ← Is run active?                       │    │
│  │  }                                                              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│           ▲                                    │                         │
│           │ Updates processed++                │ Reads state             │
│           │                                    ▼                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│               NESTJS SCHEDULER SERVICE (background)                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  @Injectable() SchedulerService                                │    │
│  │                                                                 │    │
│  │  Loop every few seconds:                                       │    │
│  │  1. Read Redis → get xTotal, yPerMinute, enqueued             │    │
│  │  2. Calculate: can I send more jobs now?                       │    │
│  │  3. Rate limit: only Y jobs per minute                         │    │
│  │  4. Create job messages: {jobId: 501}                          │    │
│  │  5. Push to RabbitMQ queue                                     │    │
│  │  6. Update Redis: enqueued++                                   │    │
│  └────────────────────────────────────────────────────────────────┘    │
│           │                                                              │
│           │ Publishes job messages                                      │
│           ▼                                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    RABBITMQ (:5672)                                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Queue: "optio.jobs" (durable, persistent)                     │    │
│  │  ┌───────┬───────┬───────┬───────┬───────┐                    │    │
│  │  │ Job 1 │ Job 2 │ Job 3 │ Job 4 │ ...   │  ← Message buffer  │    │
│  │  └───────┴───────┴───────┴───────┴───────┘                    │    │
│  │                                                                 │    │
│  │  • Holds jobs safely even if workers crash                     │    │
│  │  • Distributes jobs across multiple workers                    │    │
│  │  • Only removes job after worker sends "ack"                   │    │
│  └────────────────────────────────────────────────────────────────┘    │
│           │                                                              │
│           │ Consumer (prefetch=10)                                      │
│           ▼                                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│          NESTJS WORKER SERVICE (scalable: can run 1-10 instances)       │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  @Injectable() WorkerService                                   │    │
│  │  @EventPattern('optio.jobs')  ← RabbitMQ consumer             │    │
│  │                                                                 │    │
│  │  For each job message received:                                │    │
│  │  1. Receive: {jobId: 501}                                      │    │
│  │  2. Process job (simulate work or actual task)                 │    │
│  │  3. Write to Elasticsearch with _id=jobId (prevents duplicates)│    │
│  │  4. Update Redis: processed++                                  │    │
│  │  5. Send "ack" to RabbitMQ (job done, remove from queue)      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│           │                                    │                         │
│           │                                    │                         │
│           ▼                                    ▼                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐    ┌──────────────────────────────┐
│  ELASTICSEARCH (:9200)       │    │  REDIS (updates)             │
│  ┌────────────────────────┐  │    │  optio:run → processed: 46  │
│  │ Index: optio_jobs      │  │    └──────────────────────────────┘
│  │ ┌────────────────────┐ │  │              │
│  │ │ {                  │ │  │              │ Triggers WebSocket
│  │ │   _id: "501",      │ │  │              ▼
│  │ │   jobId: 501,      │ │  │    ┌──────────────────────────────┐
│  │ │   createdAt: "..." │ │  │    │  API broadcasts to UI        │
│  │ │ }                  │ │  │    │  {processed: 46}             │
│  │ └────────────────────┘ │  │    └──────────────────────────────┘
│  │ ...955 more docs       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

## Key Points from the Diagram:

### **1. Data Flow Direction:**
```
User Input → API → Redis → Scheduler → RabbitMQ → Worker → Elasticsearch
                                                       ↓
                                                    Redis (counter++)
                                                       ↓
                                                  API (WebSocket)
                                                       ↓
                                                   User UI (update)
```

### **2. Why Each Component:**

- **Redis** = Shared memory (state store)
- **RabbitMQ** = Safe queue (job buffer + load balancer)
- **Elasticsearch** = Permanent storage (search & analytics)
- **WebSocket** = Push channel (real-time updates)

### **3. Scaling Example:**
```bash
docker compose up --scale worker=3
```

```
             ┌─> Worker #1 (takes jobs 1, 4, 7, ...)
RabbitMQ ──┼─> Worker #2 (takes jobs 2, 5, 8, ...)
             └─> Worker #3 (takes jobs 3, 6, 9, ...)
```

All 3 workers share the same queue, RabbitMQ ensures no duplicate processing.

---

**Does this visual help clarify the architecture?** Any specific part you want me to zoom into?