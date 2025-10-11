import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create application without HTTP server (background service)
  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('[scheduler] Scheduler service started');
  logger.log(
    `[scheduler] Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`,
  );
  logger.log(
    `[scheduler] RabbitMQ: ${process.env.AMQP_URL || 'amqp://localhost:5672'}`,
  );
}
bootstrap();
