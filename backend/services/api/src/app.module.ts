import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProgressGateway } from './progress/progress.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ProgressGateway],
})
export class AppModule {}
