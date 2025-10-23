import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseRabbitMQService } from '@optio/shared/rabbitmq/base-rabbitmq.service';
import { JobMessage } from '@optio/shared/rabbitmq/rabbitmq.interface';

@Injectable()
export class RabbitMQService
  extends BaseRabbitMQService
  implements OnModuleInit
{
  constructor() {
    super(RabbitMQService.name);
  }

  async onModuleInit() {
    await this.connect();
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
}
