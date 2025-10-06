import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { StartRunDto, RunStatusDto, MessageResponseDto } from './dto/run.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('run')
  startRun(@Body() startRunDto: StartRunDto): MessageResponseDto {
    return this.appService.startRun(startRunDto);
  }

  @Post('stop')
  stopRun(): MessageResponseDto {
    return this.appService.stopRun();
  }

  @Get('status')
  getStatus(): RunStatusDto {
    return this.appService.getStatus();
  }
}
