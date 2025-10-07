import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_KEYS } from './redis.constants';
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
        this.logger.warn(`[api] Redis reconnecting... attempt ${times}`);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.logger.log('[api] Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error(`[api] Redis error: ${err.message}`);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('[api] Redis reconnecting...');
    });

    // Wait for connection
    await this.client.ping();
    this.logger.log('[api] Redis ping successful');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('[api] Redis connection closed');
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
      this.logger.error(`[api] Failed to get run state: ${message}`);
      throw error;
    }
  }

  /**
   * Set the run state in Redis
   */
  async setRunState(state: RunState): Promise<void> {
    try {
      await this.client.set(REDIS_KEYS.RUN, JSON.stringify(state));
      this.logger.log(`[api] Run state updated: ${JSON.stringify(state)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to set run state: ${message}`);
      throw error;
    }
  }

  /**
   * Update specific fields in the run state
   */
  async updateRunState(updates: Partial<RunState>): Promise<RunState> {
    try {
      const current = await this.getRunState();
      const updated = { ...current, ...updates };
      await this.setRunState(updated);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to update run state: ${message}`);
      throw error;
    }
  }

  /**
   * Increment the next job ID counter
   */
  async getNextJobId(): Promise<number> {
    try {
      return await this.client.incr(REDIS_KEYS.QUEUE_NEXT_ID);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to get next job ID: ${message}`);
      throw error;
    }
  }

  /**
   * Reset all run data (useful for testing or cleanup)
   */
  async resetRunState(): Promise<void> {
    try {
      await this.client.del(REDIS_KEYS.RUN);
      await this.client.del(REDIS_KEYS.QUEUE_NEXT_ID);
      this.logger.log('[api] Run state reset');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to reset run state: ${message}`);
      throw error;
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
