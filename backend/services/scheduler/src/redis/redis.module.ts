import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global() // Makes RedisService available everywhere without importing the module
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
