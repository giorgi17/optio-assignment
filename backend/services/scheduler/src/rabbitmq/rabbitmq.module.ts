import { Module, Global } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

@Global() // Makes RabbitMQService available everywhere without importing the module
@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
