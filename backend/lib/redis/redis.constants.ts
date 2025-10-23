// Redis key constants following docs/REDIS_KEYS.md
export const REDIS_KEYS = {
    RUN: 'optio:run', // Stores: {running, xTotal, yMinutes, startedAt}
    ENQUEUED: 'optio:enqueued', // Counter: number of jobs enqueued
    PROCESSED: 'optio:processed', // Counter: number of jobs processed
    QUEUE_NEXT_ID: 'optio:queue:nextId',
    METRICS_TIMESTAMPS: 'optio:metrics:timestamps',
} as const;

export const REDIS_CHANNELS = {
    PROGRESS_UPDATE: 'optio:progress',
} as const;
