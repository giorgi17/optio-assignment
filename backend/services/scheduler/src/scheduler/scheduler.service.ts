import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 1000; // Check Redis every second
  private accumulatedJobs = 0; // Track fractional jobs across iterations

  constructor(
    private readonly redisService: RedisService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  onModuleInit() {
    this.logger.log('[scheduler] Scheduler service initialized');
    this.startScheduler();
  }

  onModuleDestroy() {
    this.stopScheduler();
    this.logger.log('[scheduler] Scheduler service destroyed');
  }

  /**
   * Start the main scheduling loop
   */
  private startScheduler(): void {
    this.logger.log('[scheduler] Starting scheduler loop...');

    this.intervalHandle = setInterval(() => {
      void this.scheduleJobs();
    }, this.POLL_INTERVAL_MS);

    this.logger.log(
      `[scheduler] Scheduler loop started (polling every ${this.POLL_INTERVAL_MS}ms)`,
    );
  }

  /**
   * Stop the scheduling loop
   */
  private stopScheduler(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('[scheduler] Scheduler loop stopped');
    }
  }

  /**
   * Main scheduling logic - runs every second
   *
   * Rate Control Algorithm:
   * - X = Maximum number of records to process per Y minutes (rate limit)
   * - Y = Time window in minutes
   * - Rate = X / Y jobs per minute (maximum processing speed)
   * - Jobs per second = Rate / 60
   *
   * Example: X=1000, Y=10 means "maximum 1000 records per 10 minutes"
   * Rate = 1000/10 = 100 jobs/minute = 1.67 jobs/second
   *
   * Fractional Accumulation:
   * For rates < 1 job/second, we accumulate fractional jobs across iterations.
   * Example: 0.5 jobs/sec → Second 1: 0.5 (skip), Second 2: 1.0 (enqueue 1), etc.
   *
   * The scheduler continues processing jobs at this rate until user stops the run.
   */
  private async scheduleJobs(): Promise<void> {
    try {
      // 1. Read current run state from Redis
      const state = await this.redisService.getRunState();

      // 2. Check if a run is active
      if (!state.running) {
        this.accumulatedJobs = 0; // Reset accumulator when run stops
        return; // No active run, nothing to do
      }

      // 3. Calculate rate: X jobs per Y minutes → jobs per second
      // This is the MAXIMUM processing speed (rate limit)
      const rate = state.xTotal / state.yMinutes; // jobs per minute
      const jobsPerSecond = rate / 60; // convert to jobs per second

      // 4. Accumulate fractional jobs to handle slow rates accurately
      // Example: 0.5 jobs/sec → accumulate 0.5, 1.0, 1.5, 2.0 → enqueue when >= 1
      this.accumulatedJobs += jobsPerSecond;
      const jobsToEnqueue = Math.floor(this.accumulatedJobs);
      this.accumulatedJobs -= jobsToEnqueue; // Keep remainder for next iteration

      if (jobsToEnqueue === 0) {
        this.logger.debug(
          `[scheduler] Accumulating jobs (${this.accumulatedJobs.toFixed(3)}) - rate: ${rate.toFixed(2)} jobs/min`,
        );
        return; // Not enough accumulated yet
      }

      this.logger.debug(
        `[scheduler] Enqueueing ${jobsToEnqueue} jobs (rate limit: ${rate.toFixed(2)} jobs/min, ${jobsPerSecond.toFixed(3)} jobs/sec)`,
      );

      // 5. Enqueue jobs to RabbitMQ at the controlled rate
      for (let i = 0; i < jobsToEnqueue; i++) {
        // Get current state for accurate job ID
        const currentState = await this.redisService.getRunState();

        // Create job message with unique ID
        const jobId = currentState.enqueued + 1;
        const message = {
          jobId,
          data: {
            runId: state.startedAt,
            number: Math.floor(Math.random() * 1000000), // Random number to process
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        };

        // Publish to RabbitMQ
        const published = this.rabbitMQService.publishJob(message);

        if (published) {
          // Increment enqueued counter in Redis (atomic operation)
          await this.redisService.incrementEnqueued();
        } else {
          this.logger.warn(
            `[scheduler] Failed to publish job ${jobId}, will retry next interval`,
          );
          break; // Stop enqueueing if RabbitMQ is unavailable
        }
      }

      const updatedState = await this.redisService.getRunState();
      this.logger.log(
        `[scheduler] Total enqueued: ${updatedState.enqueued} jobs (rate: ${rate.toFixed(2)} jobs/min)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[scheduler] Error in scheduling loop: ${message}`);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; pollInterval: number } {
    return {
      running: this.intervalHandle !== null,
      pollInterval: this.POLL_INTERVAL_MS,
    };
  }
}
