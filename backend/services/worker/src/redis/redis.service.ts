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
      return JSON.parse(state) as RunState;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to get run state: ${message}`);
      return DEFAULT_RUN_STATE;
    }
  }

  /**
   * Atomically increment the 'processed' counter in Redis
   * Uses Lua script to ensure atomicity across multiple workers
   */
  async incrementProcessed(): Promise<number> {
    try {
      // Lua script to atomically read, increment, and write the processed count
      const script = `
        local runState = redis.call('GET', KEYS[1])
        if runState then
          local state = cjson.decode(runState)
          state.processed = state.processed + 1
          redis.call('SET', KEYS[1], cjson.encode(state))
          return state.processed
        else
          return -1
        end
      `;

      const result = (await this.client.eval(
        script,
        1,
        REDIS_KEYS.RUN,
      )) as number;

      this.logger.debug(`[worker] Processed counter incremented to: ${result}`);
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
   * Get Redis client for custom operations if needed
   */
  getClient(): Redis {
    return this.client;
  }
}
