import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseRedisService } from '@optio/shared/redis/base-redis.service';
import { REDIS_KEYS } from '@optio/shared/redis/redis.constants';

@Injectable()
export class RedisService extends BaseRedisService implements OnModuleInit {
  constructor() {
    super(RedisService.name);
  }

  onModuleInit() {
    // Initialize with worker-specific options
    this.initializeRedis('worker', {
      maxRetriesPerRequest: null,
    });
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
}
