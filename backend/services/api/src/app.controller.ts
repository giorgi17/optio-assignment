import { Controller, Get, Post, Put, Body } from '@nestjs/common';
import { AppService } from './app.service';
import {
  StartRunDto,
  UpdateRunDto,
  RunStatusDto,
  MessageResponseDto,
} from './dto/run.dto';
import { HealthResponseDto } from './dto/health.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('run')
  async startRun(
    @Body() startRunDto: StartRunDto,
  ): Promise<MessageResponseDto> {
    return this.appService.startRun(startRunDto);
  }

  @Put('run')
  async updateRun(
    @Body() updateRunDto: UpdateRunDto,
  ): Promise<MessageResponseDto> {
    return this.appService.updateRun(updateRunDto);
  }

  @Post('stop')
  async stopRun(): Promise<MessageResponseDto> {
    return this.appService.stopRun();
  }

  @Get('status')
  async getStatus(): Promise<RunStatusDto> {
    return this.appService.getStatus();
  }

  @Get('health')
  async getHealth(): Promise<HealthResponseDto> {
    return this.appService.getHealth();
  }
}
