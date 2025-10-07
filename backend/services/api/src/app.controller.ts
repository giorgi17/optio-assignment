import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { StartRunDto, RunStatusDto, MessageResponseDto } from './dto/run.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('run')
  async startRun(
    @Body() startRunDto: StartRunDto,
  ): Promise<MessageResponseDto> {
    return this.appService.startRun(startRunDto);
  }

  @Post('stop')
  async stopRun(): Promise<MessageResponseDto> {
    return this.appService.stopRun();
  }

  @Get('status')
  async getStatus(): Promise<RunStatusDto> {
    return this.appService.getStatus();
  }
}
