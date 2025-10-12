import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_KEYS, REDIS_CHANNELS } from './redis.constants';
import { RunState, DEFAULT_RUN_STATE } from './redis.interface';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.logger.log(`[worker] Connecting to Redis: ${redisUrl}`);

    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(
          `[worker] Redis connection failed. Retrying in ${delay}ms...`,
        );
        return delay;
      },
      maxRetriesPerRequest: null,
    });

    this.client.on('connect', () => {
      this.logger.log('[worker] Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error(`[worker] Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('[worker] Redis connection closed');
  }

  /**
   * Get current run state from Redis
   */
  async getRunState(): Promise<RunState> {
    try {
      const state = await this.client.get(REDIS_KEYS.RUN);
      if (!state) {
        return DEFAULT_RUN_STATE;
      }

      const baseState = JSON.parse(state) as Omit<
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to get run state: ${message}`);
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
   * Atomically increment the 'processed' counter in Redis
   * Uses Redis INCR for atomic increment (no race conditions!)
   */
  async incrementProcessed(): Promise<number> {
    try {
      // Redis INCR is atomic - no Lua script needed!
      const result = await this.client.incr(REDIS_KEYS.PROCESSED);

      this.logger.debug(`[worker] Processed counter incremented to: ${result}`);

      // Publish progress update to Redis channel
      await this.publishProgressUpdate();

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[worker] Failed to increment processed count: ${message}`,
      );
      throw error;
    }
  }

  /**
   * Publish progress update to Redis Pub/Sub channel
   * This notifies the API to broadcast updates via WebSocket
   */
  private async publishProgressUpdate(): Promise<void> {
    try {
      const state = await this.getRunState();
      await this.client.publish(
        REDIS_CHANNELS.PROGRESS_UPDATE,
        JSON.stringify(state),
      );
      this.logger.debug('[worker] Published progress update to Redis channel');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[worker] Failed to publish progress update: ${message}`,
      );
      // Don't throw - publishing is not critical for job processing
    }
  }

  /**
   * Get Redis client for custom operations if needed
   */
  getClient(): Redis {
    return this.client;
  }
}
