import { Controller, Get, Post } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    return this.healthService.check();
  }

  @Get('dev-mailbox')
  getDevMailbox() {
    return this.healthService.getDevMailbox();
  }

  @Post('smoke-test')
  async runSmokeTest() {
    return this.healthService.runSmokeTest();
  }
}
