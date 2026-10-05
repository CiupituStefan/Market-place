import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAME } from '../config.js';

/**
 * Kubernetes probes. Liveness only says "the process is responsive"; readiness
 * will also check owned dependencies (database, Kafka) once they are wired in.
 */
@Controller('health')
export class HealthController {
  @Get('live')
  live(): { status: 'ok'; service: string } {
    return { status: 'ok', service: SERVICE_NAME };
  }

  @Get('ready')
  ready(): { status: 'ok'; service: string; checks: Record<string, 'up' | 'down'> } {
    return { status: 'ok', service: SERVICE_NAME, checks: {} };
  }
}
