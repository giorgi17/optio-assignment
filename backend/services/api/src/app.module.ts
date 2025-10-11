import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProgressGateway } from './progress/progress.gateway';
import { ProgressService } from './progress/progress.service';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [AppController],
  providers: [AppService, ProgressGateway, ProgressService],
})
export class AppModule {}
