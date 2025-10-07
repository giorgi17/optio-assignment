import { Injectable, Logger } from '@nestjs/common';
import { StartRunDto, RunStatusDto, MessageResponseDto } from './dto/run.dto';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  // Stub implementation - will be replaced with Redis in TASK-3
  startRun(startRunDto: StartRunDto): MessageResponseDto {
    this.logger.log(
      `[api] Starting run with X=${startRunDto.x}, Y=${startRunDto.y}`,
    );

    // TODO: TASK-3 - Store in Redis
    return {
      message: 'Run started',
      x: startRunDto.x,
      y: startRunDto.y,
    };
  }

  stopRun(): MessageResponseDto {
    this.logger.log('[api] Stopping run');

    // TODO: TASK-3 - Update Redis
    return {
      message: 'Run stopped',
    };
  }

  getStatus(): RunStatusDto {
    // TODO: TASK-3 - Read from Redis
    return {
      running: false,
      xTotal: 0,
      yMinutes: 0,
      enqueued: 0,
      processed: 0,
    };
  }
}
