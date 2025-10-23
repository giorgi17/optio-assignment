import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseRedisService } from '@optio/shared/redis/base-redis.service';
import { REDIS_KEYS } from '@optio/shared/redis/redis.constants';

@Injectable()
export class RedisService extends BaseRedisService implements OnModuleInit {
  constructor() {
    super(RedisService.name);
  }

  async onModuleInit() {
    // Initialize with scheduler-specific options
    this.initializeRedis('scheduler', {
      maxRetriesPerRequest: 3,
    });

    // Wait for connection
    await this.client.ping();
    this.logger.log('[scheduler] Redis ping successful');
  }

  /**
   * Increment the enqueued counter
   * Uses Redis INCR for atomic increment (no race conditions!)
   */
  async incrementEnqueued(): Promise<number> {
    try {
      // Redis INCR is atomic - no Lua script needed!
      const result = await this.client.incr(REDIS_KEYS.ENQUEUED);

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
}
