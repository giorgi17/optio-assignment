// Redis key constants following docs/REDIS_KEYS.md
export const REDIS_KEYS = {
  RUN: 'optio:run',
  QUEUE_NEXT_ID: 'optio:queue:nextId',
  METRICS_TIMESTAMPS: 'optio:metrics:timestamps',
} as const;
