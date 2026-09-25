import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@ecomesta/types';
import { HealthService } from './health.service';

@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<{ success: true; data: HealthStatus }> {
    const data = await this.healthService.getStatus();
    return { success: true, data };
  }
}
