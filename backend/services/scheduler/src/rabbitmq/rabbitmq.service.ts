import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as amqp from 'amqplib';

export interface JobMessage {
  jobId: number;
  data: any;
  timestamp: string;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queueName = 'optio.jobs';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    await this.disconnect();
  }

  /**
   * Connect to RabbitMQ with retry logic
   */
  private async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5672';

    try {
      this.logger.log('[scheduler] Connecting to RabbitMQ...');

      // Create connection (type assertion needed due to incomplete @types/amqplib)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.connection = (await amqp.connect(amqpUrl)) as any;

      this.logger.log('[scheduler] RabbitMQ connected successfully');

      // Handle connection events
      this.connection!.on('error', (err: Error) => {
        this.logger.error(
          `[scheduler] RabbitMQ connection error: ${err.message}`,
        );
      });

      this.connection!.on('close', () => {
        this.logger.warn(
          '[scheduler] RabbitMQ connection closed, reconnecting...',
        );
        this.connection = null;
        this.channel = null;
        this.scheduleReconnect();
      });

      // Create channel (type assertion needed due to incomplete @types/amqplib)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.channel = await (this.connection as any).createChannel();
      this.logger.log('[scheduler] RabbitMQ channel created');

      // Handle channel events
      this.channel!.on('error', (err: Error) => {
        this.logger.error(`[scheduler] RabbitMQ channel error: ${err.message}`);
      });

      this.channel!.on('close', () => {
        this.logger.warn('[scheduler] RabbitMQ channel closed');
        this.channel = null;
      });

      // Assert queue with durability
      await this.channel!.assertQueue(this.queueName, {
        durable: true, // Queue survives RabbitMQ restart
      });

      this.logger.log(
        `[scheduler] Queue '${this.queueName}' asserted (durable: true)`,
      );

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[scheduler] Failed to connect to RabbitMQ: ${message}`,
      );
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    const delay = 5000; // 5 seconds
    this.logger.log(`[scheduler] Scheduling reconnect in ${delay}ms...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      void this.connect();
    }, delay);
  }

  /**
   * Disconnect from RabbitMQ
   */
  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
        this.logger.log('[scheduler] RabbitMQ channel closed');
      }

      if (this.connection) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.connection as any).close();
        this.connection = null;
        this.logger.log('[scheduler] RabbitMQ connection closed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[scheduler] Error during disconnect: ${message}`);
    }
  }

  /**
   * Publish a job message to the queue
   */
  publishJob(message: JobMessage): boolean {
    if (!this.channel) {
      this.logger.error('[scheduler] Cannot publish: channel not available');
      return false;
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));

      const result = this.channel.sendToQueue(this.queueName, messageBuffer, {
        persistent: true, // Message survives RabbitMQ restart
        contentType: 'application/json',
        timestamp: Date.now(),
      });

      if (result) {
        this.logger.debug(
          `[scheduler] Published job ${message.jobId} to queue '${this.queueName}'`,
        );
      } else {
        this.logger.warn(
          `[scheduler] Failed to publish job ${message.jobId}: queue buffer full`,
        );
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`[scheduler] Error publishing job: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Check if RabbitMQ is connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Get channel for advanced operations
   */
  getChannel(): amqp.Channel | null {
    return this.channel;
  }
}
