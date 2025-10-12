# WebSocket Progress Updates - Testing Guide

## Overview

Real-time progress updates are implemented using **Redis Pub/Sub** + **Socket.IO WebSocket**.

## Architecture

```
Worker/Scheduler → Redis Pub/Sub → API Service → WebSocket → Frontend
```

### Flow:

1. **Worker** increments `processed` counter → publishes to Redis channel `optio:progress`
2. **Scheduler** increments `enqueued` counter (every 10 jobs) → publishes to Redis channel `optio:progress`
3. **API** subscribes to `optio:progress` channel → receives updates
4. **API** broadcasts updates via Socket.IO to all connected WebSocket clients
5. **Frontend** receives real-time progress updates

## Testing Methods

### Method 1: HTML Test Client (Browser)

Open the test file in your browser:
```bash
open backend/services/api/test-websocket.html
# or simply double-click the file
```

1. Click "Connect" button
2. Start a run: `curl -X POST http://localhost:3000/api/run -H "Content-Type: application/json" -d '{"x": 100, "y": 1}'`
3. Watch progress updates appear in real-time!

### Method 2: CLI Test (Node.js)

```bash
# Install socket.io-client if not already installed
npm install socket.io-client

# Run the CLI test
node test-websocket-cli.js
```

In another terminal, start a run:
```bash
curl -X POST http://localhost:3000/api/run -H "Content-Type: application/json" -d '{"x": 100, "y": 1}'
```

You'll see real-time progress updates in the terminal!

### Method 3: Browser DevTools

Open browser console and run:
```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected!');
});

socket.on('progress', (data) => {
  console.log('📊 Progress:', data);
});
```

## WebSocket Event Format

The `progress` event emits the following data:

```json
{
  "running": true,
  "xTotal": 100,
  "yMinute": 1,
  "enqueued": 45,
  "processed": 42
}
```

## Implementation Details

### Backend Components

#### 1. Worker Service (`backend/services/worker/src/redis/redis.service.ts`)
- Publishes to Redis channel after incrementing `processed` counter
- Uses atomic Lua script for counter updates

#### 2. Scheduler Service (`backend/services/scheduler/src/redis/redis.service.ts`)
- Publishes to Redis channel every 10 enqueued jobs (to avoid spam)
- Uses atomic Lua script for counter updates

#### 3. API Service (`backend/services/api/src/progress/`)
- **`progress.service.ts`**: Subscribes to Redis Pub/Sub channel
- **`progress.gateway.ts`**: WebSocket gateway using Socket.IO
- Broadcasts progress updates to all connected clients

### Redis Channel

- **Channel Name**: `optio:progress`
- **Message Format**: JSON-stringified `RunState` object

### Why Redis Pub/Sub?

✅ **Real-time**: Updates are pushed immediately  
✅ **Decoupled**: Worker/Scheduler don't need to know about WebSocket  
✅ **Scalable**: Multiple API instances can subscribe  
✅ **Simple**: No polling needed  

## Acceptance Criteria ✅

✅ **Frontend sees live `enqueued`/`processed` moving**
- Verified via browser test client
- Verified via CLI test
- Logs show: `[api] Received progress update: enqueued=X, processed=Y`

✅ **Updates are real-time**
- Worker publishes on every job processed
- Scheduler publishes every 10 jobs enqueued
- API broadcasts immediately to WebSocket clients

✅ **Multiple clients supported**
- Socket.IO handles multiple connections
- Each client receives the same updates

## Troubleshooting

### No updates received?

1. Check API logs: `docker logs optio-api --tail 50`
   - Should see: `[api] Subscribed to Redis channel: optio:progress`
   - Should see: `[api] Received progress update: ...`

2. Check Worker/Scheduler logs for publishing:
   - `docker logs optio-worker --tail 50`
   - Should see: `[worker] Published progress update to Redis channel`

3. Verify Redis connection:
   ```bash
   docker exec -it optio-redis redis-cli
   > PUBSUB CHANNELS
   # Should list: "optio:progress"
   ```

### Connection refused?

- Ensure API is running: `curl http://localhost:3000/api/health`
- Check CORS configuration in `backend/services/api/src/main.ts`