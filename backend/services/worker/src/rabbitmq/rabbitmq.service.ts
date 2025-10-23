import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { BaseRabbitMQService } from '@optio/shared/rabbitmq/base-rabbitmq.service';
import { JobMessage } from '@optio/shared/rabbitmq/rabbitmq.interface';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RabbitMQService
  extends BaseRabbitMQService
  implements OnModuleInit
{
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly redisService: RedisService,
  ) {
    super(RabbitMQService.name);
  }

  async onModuleInit() {
    await this.connect();
  }

  /**
   * Override hook to set up worker-specific channel configuration
   */
  protected async onChannelReady(): Promise<void> {
    // Set prefetch limit (max 10 unacknowledged messages)
    await this.channel!.prefetch(10);
    this.logger.log('[worker] Prefetch limit set to 10');

    // Start consuming messages
    await this.startConsuming();
  }

  /**
   * Start consuming messages from the queue
   */
  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      this.logger.error(
        '[worker] Cannot start consuming: channel not available',
      );
      return;
    }

    try {
      await this.channel.consume(
        this.queueName,
        (msg: ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          this.handleMessage(msg).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `[worker] Unhandled error in message handler: ${message}`,
            );
          });
        },
        {
          noAck: false, // Manual acknowledgment
        },
      );

      this.logger.log(
        `[worker] Started consuming messages from queue '${this.queueName}'`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to start consuming: ${message}`);
      throw error;
    }
  }

  /**
   * Handle a single message from the queue
   */
  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    try {
      // Parse message
      const job: JobMessage = JSON.parse(msg.content.toString()) as JobMessage;
      this.logger.log(`[worker] Processing job ${job.jobId}`);

      // Process the job
      await this.processJob(job);

      // Acknowledge successful processing
      if (this.channel) {
        this.channel.ack(msg);
        this.logger.log(`[worker] Job ${job.jobId} completed and acknowledged`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Job processing failed: ${message}`);

      // Reject and requeue the message for retry
      if (this.channel) {
        this.channel.nack(msg, false, true); // requeue=true
        this.logger.warn('[worker] Message rejected and requeued for retry');
      }
    }
  }

  /**
   * Process a job: calculate result, write to Elasticsearch, update Redis counter
   */
  private async processJob(job: JobMessage): Promise<void> {
    // 1. Simulate processing work (calculate something)
    const result = this.calculateResult(job.data.number);

    this.logger.debug(
      `[worker] Job ${job.jobId} calculated: ${job.data.number} -> ${result.output}`,
    );

    // 2. Write to Elasticsearch (idempotent using jobId as document ID)
    await this.elasticsearchService.indexJob({
      jobId: job.jobId,
      runId: job.data.runId,
      input: job.data.number,
      output: result.output,
      processedAt: new Date().toISOString(),
      timestamp: job.timestamp,
    });

    this.logger.debug(`[worker] Job ${job.jobId} indexed to Elasticsearch`);

    // 3. Update Redis 'processed' counter (atomic operation)
    const processedCount = await this.redisService.incrementProcessed();

    this.logger.debug(
      `[worker] Job ${job.jobId} completed (total processed: ${processedCount})`,
    );
  }

  /**
   * Calculate result from input number
   * Simple example: square the number
   */
  private calculateResult(input: number): { input: number; output: number } {
    return {
      input,
      output: input * input, // Square the number
    };
  }
}
