import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { and, asc, eq, lt } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { orders } from '../db/schema.js';
import { CheckoutService } from './checkout.service.js';
import { OrderService } from './order.service.js';

/**
 * Housekeeping that keeps stock and discount codes from being held forever:
 * - unpaid orders past their payment window (+ grace) are cancelled;
 * - checkouts stuck in PENDING (crash between saga steps) are compensated.
 * Every action is idempotent and row-locked, so several replicas may sweep at once.
 */
@Injectable()
export class OrderSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OrderSweeper.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<unknown> | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: Database,
    private readonly orders: OrderService,
    private readonly checkout: CheckoutService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.SWEEPER_ENABLED) return;
    this.timer = setInterval(() => {
      this.running ??= this.sweep().finally(() => {
        this.running = undefined;
      });
    }, this.config.SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  async sweep(now = new Date()): Promise<{ expired: number; compensated: number }> {
    const result = { expired: 0, compensated: 0 };
    try {
      const unpaidBefore = new Date(now.getTime() - this.config.PAYMENT_GRACE_SECONDS * 1_000);
      const unpaid = await this.db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.status, 'PENDING_PAYMENT'), lt(orders.paymentDueAt, unpaidBefore)))
        .orderBy(asc(orders.paymentDueAt))
        .limit(this.config.SWEEP_BATCH_SIZE);
      result.expired = await this.orders.expire(unpaid.map((row) => row.id));

      const staleBefore = new Date(now.getTime() - this.config.CHECKOUT_STALE_SECONDS * 1_000);
      const stale = await this.db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.status, 'PENDING'), lt(orders.createdAt, staleBefore)))
        .orderBy(asc(orders.createdAt))
        .limit(this.config.SWEEP_BATCH_SIZE);
      for (const { id } of stale) {
        await this.checkout.compensateStale(id);
        result.compensated += 1;
      }
      if (result.expired + result.compensated > 0) {
        this.logger.log(
          `cancelled ${String(result.expired)} unpaid order(s), compensated ${String(result.compensated)} stuck checkout(s)`,
        );
      }
    } catch (error) {
      this.logger.error(`order sweep failed: ${String(error)}`);
    }
    return result;
  }
}
