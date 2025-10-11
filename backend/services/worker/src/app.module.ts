import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [RedisModule, ElasticsearchModule, RabbitMQModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
