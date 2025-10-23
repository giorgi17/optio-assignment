import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseRedisService } from '@optio/shared/redis/base-redis.service';
import { REDIS_KEYS } from '@optio/shared/redis/redis.constants';
import { RunState } from '@optio/shared/redis/redis.interface';

@Injectable()
export class RedisService extends BaseRedisService implements OnModuleInit {
  constructor() {
    super(RedisService.name);
  }

  async onModuleInit() {
    // Initialize with API-specific options
    this.initializeRedis('api', {
      maxRetriesPerRequest: 3,
    });

    // Wait for connection
    await this.client.ping();
    this.logger.log('[api] Redis ping successful');
  }

  /**
   * Set the run state in Redis
   * Note: Counters (enqueued/processed) are stored separately
   */
  async setRunState(state: RunState): Promise<void> {
    try {
      // Store base state (without counters)
      const { enqueued, processed, ...baseState } = state;

      await this.client.set(REDIS_KEYS.RUN, JSON.stringify(baseState));

      // Set counters separately (only if starting a new run)
      if (state.running && state.startedAt) {
        await this.client.set(REDIS_KEYS.ENQUEUED, enqueued.toString());
        await this.client.set(REDIS_KEYS.PROCESSED, processed.toString());
      }

      this.logger.log(`[api] Run state updated: ${JSON.stringify(baseState)}`);
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
      await this.client.del(REDIS_KEYS.ENQUEUED);
      await this.client.del(REDIS_KEYS.PROCESSED);
      await this.client.del(REDIS_KEYS.QUEUE_NEXT_ID);
      this.logger.log('[api] Run state reset');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to reset run state: ${message}`);
      throw error;
    }
  }
}
