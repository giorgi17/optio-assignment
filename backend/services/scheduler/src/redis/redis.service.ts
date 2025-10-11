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

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`[scheduler] Redis reconnecting... attempt ${times}`);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.logger.log('[scheduler] Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error(`[scheduler] Redis error: ${err.message}`);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('[scheduler] Redis reconnecting...');
    });

    // Wait for connection
    await this.client.ping();
    this.logger.log('[scheduler] Redis ping successful');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('[scheduler] Redis connection closed');
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

      return JSON.parse(data) as RunState;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[scheduler] Failed to get run state: ${message}`);
      throw error;
    }
  }

  /**
   * Increment the enqueued counter in the run state
   * This is an atomic operation to safely track how many jobs have been enqueued
   */
  async incrementEnqueued(): Promise<number> {
    try {
      // Use a Lua script for atomic read-modify-write
      const script = `
        local key = KEYS[1]
        local data = redis.call('GET', key)
        if not data then
          return 0
        end
        local state = cjson.decode(data)
        state.enqueued = state.enqueued + 1
        redis.call('SET', key, cjson.encode(state))
        return state.enqueued
      `;

      const result = (await this.client.eval(
        script,
        1,
        REDIS_KEYS.RUN,
      )) as number;

      this.logger.debug(
        `[scheduler] Enqueued counter incremented to: ${result}`,
      );

      // Publish progress update to Redis channel (every 10 jobs to avoid spam)
      if (result % 10 === 0) {
        await this.publishProgressUpdate();
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[scheduler] Failed to increment enqueued: ${message}`);
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
      this.logger.debug(
        '[scheduler] Published progress update to Redis channel',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[scheduler] Failed to publish progress update: ${message}`,
      );
      // Don't throw - publishing is not critical for job enqueueing
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
