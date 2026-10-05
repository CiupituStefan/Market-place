import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { ReservationService } from './reservation.service.js';

/**
 * Periodically releases expired reservations. Runs in every replica; the sweep
 * uses SKIP LOCKED so replicas share the work instead of fighting over it.
 */
@Injectable()
export class ExpiryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ExpiryWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<number> | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly reservations: ReservationService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.EXPIRY_WORKER_ENABLED) return;
    this.timer = setInterval(() => {
      // Never overlap sweeps within one process.
      this.running ??= this.sweep().finally(() => {
        this.running = undefined;
      });
    }, this.config.EXPIRY_SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** Drains every due reservation, batch by batch. */
  async sweep(): Promise<number> {
    let total = 0;
    try {
      for (;;) {
        const released = await this.reservations.expireDue();
        total += released;
        if (released < this.config.EXPIRY_BATCH_SIZE) break;
      }
      if (total > 0) this.logger.log(`released ${total} expired reservation(s)`);
    } catch (error) {
      this.logger.error(`expiry sweep failed: ${String(error)}`);
    }
    return total;
  }
}
