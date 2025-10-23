import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable CORS for Angular frontend
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    credentials: true,
  });

  // Configure Redis adapter for Socket.IO (enables horizontal scaling)
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(`[api] API running on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(
    '[api] WebSocket configured with Redis adapter for horizontal scaling',
    'Bootstrap',
  );
}
bootstrap();
