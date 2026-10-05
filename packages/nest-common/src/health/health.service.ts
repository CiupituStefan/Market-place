import { Inject, Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import {
  HEALTH_CHECKS,
  HEALTH_SERVICE_NAME,
  type CheckStatus,
  type HealthCheck,
  type ReadinessReport,
} from './health.types.js';

const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService implements BeforeApplicationShutdown {
  private draining = false;

  constructor(
    @Inject(HEALTH_SERVICE_NAME) readonly serviceName: string,
    @Inject(HEALTH_CHECKS) private readonly checks: HealthCheck[],
  ) {}

  /** On SIGTERM, report not-ready first so Kubernetes stops routing new traffic here. */
  beforeApplicationShutdown(): void {
    this.draining = true;
  }

  async readiness(): Promise<ReadinessReport> {
    const results = await Promise.all(
      this.checks.map(async (check) => [check, await runCheck(check)] as const),
    );
    const failedCritical = results.some(
      ([check, status]) => status === 'down' && check.critical !== false,
    );
    return {
      status: this.draining || failedCritical ? 'error' : 'ok',
      service: this.serviceName,
      checks: Object.fromEntries(results.map(([check, status]) => [check.name, status])),
    };
  }
}

async function runCheck(check: HealthCheck): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      check.check(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('timeout'));
        }, CHECK_TIMEOUT_MS);
      }),
    ]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
