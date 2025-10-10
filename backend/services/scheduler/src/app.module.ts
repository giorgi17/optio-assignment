import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [RedisModule, RabbitMQModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
