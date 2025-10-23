import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ProgressGateway } from './progress.gateway';
import { REDIS_CHANNELS } from '@optio/shared/redis/redis.constants';
import { RunState } from '@optio/shared/redis/redis.interface';

@Injectable()
export class ProgressService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProgressService.name);
  private subscriber: Redis;

  constructor(private readonly progressGateway: ProgressGateway) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.logger.log(`[api] Setting up Redis subscriber for progress updates`);

    // Create a separate Redis client for pub/sub
    this.subscriber = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(
          `[api] Redis subscriber reconnecting... attempt ${times}`,
        );
        return delay;
      },
      maxRetriesPerRequest: null,
    });

    this.subscriber.on('connect', () => {
      this.logger.log('[api] Redis subscriber connected');
    });

    this.subscriber.on('error', (err) => {
      this.logger.error(`[api] Redis subscriber error: ${err.message}`);
    });

    // Subscribe to progress updates channel
    await this.subscriber.subscribe(REDIS_CHANNELS.PROGRESS_UPDATE);
    this.logger.log(
      `[api] Subscribed to Redis channel: ${REDIS_CHANNELS.PROGRESS_UPDATE}`,
    );

    // Handle incoming messages
    this.subscriber.on('message', (channel, message) => {
      if (channel === REDIS_CHANNELS.PROGRESS_UPDATE) {
        this.handleProgressUpdate(message);
      }
    });
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(REDIS_CHANNELS.PROGRESS_UPDATE);
      await this.subscriber.quit();
      this.logger.log('[api] Redis subscriber connection closed');
    }
  }

  /**
   * Handle progress update from Redis Pub/Sub
   */
  private handleProgressUpdate(message: string): void {
    try {
      const state: RunState = JSON.parse(message) as RunState;
      this.logger.log(
        `[api] Received progress update: enqueued=${state.enqueued}, processed=${state.processed}`,
      );

      // Broadcast to all connected WebSocket clients
      this.progressGateway.broadcastProgress({
        running: state.running,
        xTotal: state.xTotal,
        yMinute: state.yMinutes,
        enqueued: state.enqueued,
        processed: state.processed,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[api] Failed to handle progress update: ${errorMessage}`,
      );
    }
  }
}
