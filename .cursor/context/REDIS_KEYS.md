# Redis Keys
- `optio:run`: JSON `{ running, xTotal, yMinutes, enqueued, processed, startedAt }`
  - `xTotal`: Total number of jobs to process
  - `yMinutes`: Duration in minutes to process X jobs (Rate = X/Y jobs per minute)
  - `enqueued`: Number of jobs enqueued to RabbitMQ so far
  - `processed`: Number of jobs completed by workers
- `optio:queue:nextId`: integer counter for assigning `jobId` if needed
- `optio:metrics:timestamps`: optional list for quick rate checks (trimmed)