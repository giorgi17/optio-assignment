import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Connection, Channel, ConsumeMessage } from 'amqplib';
import { JobMessage } from './rabbitmq.interface';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly queueName = 'optio.jobs';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5672';

    try {
      this.logger.log('[worker] Connecting to RabbitMQ...');

      // Create connection (type assertion needed due to incomplete @types/amqplib)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.connection = (await amqp.connect(amqpUrl)) as any;

      this.logger.log('[worker] RabbitMQ connected successfully');

      // Handle connection events
      this.connection!.on('error', (err: Error) => {
        this.logger.error(`[worker] RabbitMQ connection error: ${err.message}`);
      });

      this.connection!.on('close', () => {
        this.logger.warn(
          '[worker] RabbitMQ connection closed, reconnecting...',
        );
        this.connection = null;
        this.channel = null;
        this.scheduleReconnect();
      });

      // Create channel (type assertion needed due to incomplete @types/amqplib)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.channel = await (this.connection as any).createChannel();
      this.logger.log('[worker] RabbitMQ channel created');

      // Handle channel events
      this.channel!.on('error', (err: Error) => {
        this.logger.error(`[worker] RabbitMQ channel error: ${err.message}`);
      });

      this.channel!.on('close', () => {
        this.logger.warn('[worker] RabbitMQ channel closed');
        this.channel = null;
      });

      // Assert queue with durability
      await this.channel!.assertQueue(this.queueName, {
        durable: true, // Queue survives RabbitMQ restart
      });

      this.logger.log(
        `[worker] Queue '${this.queueName}' asserted (durable: true)`,
      );

      // Set prefetch limit (max 10 unacknowledged messages)
      await this.channel!.prefetch(10);
      this.logger.log('[worker] Prefetch limit set to 10');

      // Start consuming messages
      await this.startConsuming();

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to connect to RabbitMQ: ${message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      void this.connect();
    }, 5000);

    this.logger.log('[worker] Reconnection scheduled in 5 seconds...');
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
        this.logger.log('[worker] RabbitMQ channel closed');
      }

      if (this.connection) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.connection as any).close();
        this.connection = null;
        this.logger.log('[worker] RabbitMQ connection closed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Error during disconnect: ${message}`);
    }
  }

  /**
   * Start consuming messages from the queue
   */
  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      this.logger.error('[worker] Cannot start consuming: channel not available');
      return;
    }

    try {
      await this.channel.consume(
        this.queueName,
        async (msg: ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          await this.handleMessage(msg);
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
      const job: JobMessage = JSON.parse(msg.content.toString());
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

