import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create application without HTTP server (background service)
  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('[worker] Worker service started');
  logger.log(
    `[worker] Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`,
  );
  logger.log(
    `[worker] RabbitMQ: ${process.env.AMQP_URL || 'amqp://localhost:5672'}`,
  );
  logger.log(
    `[worker] Elasticsearch: ${process.env.ES_URL || 'http://localhost:9200'}`,
  );
}
bootstrap();
