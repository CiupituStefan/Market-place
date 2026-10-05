import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service.js';
import type { ReadinessReport } from './health.types.js';

/**
 * Kubernetes probes. Liveness only proves the event loop responds; it never
 * checks dependencies, otherwise a database blip would restart every pod.
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live(): { status: 'ok'; service: string } {
    return { status: 'ok', service: this.health.serviceName };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    res.status(report.status === 'ok' ? 200 : 503);
    return report;
  }
}
