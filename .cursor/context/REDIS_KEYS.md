# Redis Keys
- `optio:run`: JSON `{ running, xTotal, yPerMinute, enqueued, processed, startedAt }`
- `optio:queue:nextId`: integer counter for assigning `jobId` if needed
- `optio:metrics:timestamps`: optional list for quick rate checks (trimmed)