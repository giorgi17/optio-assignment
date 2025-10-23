import { Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_KEYS, REDIS_CHANNELS } from './redis.constants';
import { RunState, DEFAULT_RUN_STATE } from './redis.interface';

/**
 * Base Redis service with shared functionality for all services
 * Handles connection management, state retrieval, and progress publishing
 */
export abstract class BaseRedisService implements OnModuleDestroy {
    protected readonly logger: Logger;
    protected client: Redis;

    constructor(serviceName: string) {
        this.logger = new Logger(serviceName);
    }

    /**
     * Initialize Redis connection with service-specific configuration
     */
    protected initializeRedis(
        serviceName: string,
        options: {
            maxRetriesPerRequest?: number | null;
            waitForConnection?: boolean;
        } = {}
    ): Redis {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.logger.log(`[${serviceName}] Connecting to Redis: ${redisUrl}`);

        this.client = new Redis(redisUrl, {
            retryStrategy: times => {
                const delay = Math.min(times * 50, 2000);
                this.logger.warn(
                    `[${serviceName}] Redis reconnecting... attempt ${times}`
                );
                return delay;
            },
            maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
        });

        this.client.on('connect', () => {
            this.logger.log(`[${serviceName}] Redis connected successfully`);
        });

        this.client.on('error', err => {
            this.logger.error(`[${serviceName}] Redis error: ${err.message}`);
        });

        this.client.on('reconnecting', () => {
            this.logger.warn(`[${serviceName}] Redis reconnecting...`);
        });

        return this.client;
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.logger.log('Redis connection closed');
        }
    }

    /**
     * Get the current run state from Redis
     */
    async getRunState(): Promise<RunState> {
        try {
            const data = await this.client.get(REDIS_KEYS.RUN);

            if (!data) {
                return DEFAULT_RUN_STATE;
            }

            const baseState = JSON.parse(data) as Omit<
                RunState,
                'enqueued' | 'processed'
            >;

            // Get counters from separate keys
            const enqueued = await this.getEnqueuedCount();
            const processed = await this.getProcessedCount();

            return {
                ...baseState,
                enqueued,
                processed,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get run state: ${message}`);
            return DEFAULT_RUN_STATE;
        }
    }

    /**
     * Get the enqueued counter
     */
    async getEnqueuedCount(): Promise<number> {
        try {
            const result = await this.client.get(REDIS_KEYS.ENQUEUED);
            return result ? parseInt(result, 10) : 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get the processed counter
     */
    async getProcessedCount(): Promise<number> {
        try {
            const result = await this.client.get(REDIS_KEYS.PROCESSED);
            return result ? parseInt(result, 10) : 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Publish progress update to Redis Pub/Sub channel
     * This notifies the API to broadcast updates via WebSocket
     */
    protected async publishProgressUpdate(): Promise<void> {
        try {
            const state = await this.getRunState();
            await this.client.publish(
                REDIS_CHANNELS.PROGRESS_UPDATE,
                JSON.stringify(state)
            );
            this.logger.debug('Published progress update to Redis channel');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to publish progress update: ${message}`);
            // Don't throw - publishing is not critical
        }
    }

    /**
     * Check if Redis is connected
     */
    async isConnected(): Promise<boolean> {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        } catch {
            return false;
        }
    }

    /**
     * Get raw Redis client (for advanced operations if needed)
     */
    getClient(): Redis {
        return this.client;
    }
}
