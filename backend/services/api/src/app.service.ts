import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StartRunDto, RunStatusDto, MessageResponseDto } from './dto/run.dto';
import { HealthResponseDto } from './dto/health.dto';
import { RedisService } from './redis/redis.service';
import { DEFAULT_RUN_STATE } from './redis/redis.interface';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Start a new job run
   * Validates that no run is currently active before starting
   */
  async startRun(startRunDto: StartRunDto): Promise<MessageResponseDto> {
    try {
      this.logger.log(
        `[api] Starting run with X=${startRunDto.x}, Y=${startRunDto.y}`,
      );

      // Check if a run is already active
      const currentState = await this.redisService.getRunState();
      if (currentState.running) {
        this.logger.warn(
          `[api] Attempted to start run while another is active`,
        );
        throw new ConflictException(
          'A run is already in progress. Please stop the current run first.',
        );
      }

      // Validate input
      if (startRunDto.x <= 0 || startRunDto.y <= 0) {
        throw new ConflictException('X and Y must be positive numbers');
      }

      // Start new run
      await this.redisService.setRunState({
        running: true,
        xTotal: startRunDto.x,
        yMinutes: startRunDto.y,
        enqueued: 0,
        processed: 0,
        startedAt: new Date().toISOString(),
      });

      this.logger.log(
        `[api] Run started successfully: X=${startRunDto.x}, Y=${startRunDto.y}`,
      );

      return {
        message: 'Run started',
        x: startRunDto.x,
        y: startRunDto.y,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to start run: ${message}`);
      throw new InternalServerErrorException('Failed to start run');
    }
  }

  /**
   * Stop the current job run
   */
  async stopRun(): Promise<MessageResponseDto> {
    try {
      this.logger.log('[api] Stopping run');

      const currentState = await this.redisService.getRunState();

      if (!currentState.running) {
        this.logger.warn('[api] Attempted to stop run but none is active');
        throw new ConflictException('No run is currently active');
      }

      // Update state to stop the run
      await this.redisService.updateRunState({ running: false });

      this.logger.log('[api] Run stopped successfully');

      return {
        message: 'Run stopped',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Failed to stop run: ${message}`);
      throw new InternalServerErrorException('Failed to stop run');
    }
  }

  /**
   * Get current run status
   * Gracefully degrades to default state if Redis is unavailable
   */
  async getStatus(): Promise<RunStatusDto> {
    try {
      const state = await this.redisService.getRunState();

      return {
        running: state.running,
        xTotal: state.xTotal,
        yMinutes: state.yMinutes,
        enqueued: state.enqueued,
        processed: state.processed,
        startedAt: state.startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[api] Redis unavailable, returning default state: ${message}`,
      );

      // Graceful degradation: return default state instead of failing
      return {
        running: DEFAULT_RUN_STATE.running,
        xTotal: DEFAULT_RUN_STATE.xTotal,
        yMinutes: DEFAULT_RUN_STATE.yMinutes,
        enqueued: DEFAULT_RUN_STATE.enqueued,
        processed: DEFAULT_RUN_STATE.processed,
        startedAt: undefined,
      };
    }
  }

  /**
   * Health check endpoint
   * Returns Redis connection status
   */
  async getHealth(): Promise<HealthResponseDto> {
    try {
      const isRedisConnected = await this.redisService.isConnected();

      if (isRedisConnected) {
        return {
          status: 'ok',
          redis: {
            connected: true,
            message: 'Redis is connected',
          },
          timestamp: new Date().toISOString(),
        };
      } else {
        this.logger.warn('[api] Health check: Redis is disconnected');
        return {
          status: 'error',
          redis: {
            connected: false,
            message: 'Redis is not connected',
          },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[api] Health check failed: ${message}`);
      return {
        status: 'error',
        redis: {
          connected: false,
          message: `Redis connection error: ${message}`,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
