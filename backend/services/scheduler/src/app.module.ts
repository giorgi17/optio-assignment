import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [RedisModule, RabbitMQModule, SchedulerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
