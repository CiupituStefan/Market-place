import { isUniqueViolation } from '@market/db';
import {
  DomainError,
  ErrorCode,
  money,
  type Currency,
  type DiscountCode,
  type DiscountType,
} from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { discountCodes, discountRedemptions, type DiscountCodeRow } from '../db/schema.js';
import { evaluateCoupon, normalizeCode } from './discount-rules.js';

export interface DiscountInput {
  code: string;
  type: DiscountType;
  value: number;
  minSubtotal: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  active: boolean;
}

export interface Redemption {
  orderId: string;
  discountCodeId: string;
  code: string;
  type: DiscountType;
  value: number;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined ? undefined : value === null ? null : new Date(value);
}

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ── back office ────────────────────────────────────────────────────────────

  async list(): Promise<DiscountCode[]> {
    const rows = await this.db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
    return rows.map((row) => this.view(row));
  }

  async create(input: DiscountInput): Promise<DiscountCode> {
    this.assertWindow(input.startsAt, input.expiresAt);
    try {
      const [row] = await this.db
        .insert(discountCodes)
        .values({
          ...input,
          code: normalizeCode(input.code),
          currency: this.config.CURRENCY,
          startsAt: toDate(input.startsAt) ?? null,
          expiresAt: toDate(input.expiresAt) ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned nothing');
      return this.view(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new DomainError(ErrorCode.CONFLICT, 'A code with this name already exists');
      throw error;
    }
  }

  /** The code itself is immutable: carts refer to it by name. */
  async update(id: string, patch: Partial<Omit<DiscountInput, 'code'>>): Promise<DiscountCode> {
    const [current] = await this.db.select().from(discountCodes).where(eq(discountCodes.id, id));
    if (!current) throw new DomainError(ErrorCode.NOT_FOUND, 'Discount code not found');
    const type = patch.type ?? current.type;
    const value = patch.value ?? current.value;
    if (type === 'PERCENTAGE' && value > 10_000) {
      throw new DomainError(ErrorCode.VALIDATION_FAILED, 'A percentage cannot exceed 100%', [
        { path: 'value', message: 'At most 10000 basis points' },
      ]);
    }
    const startsAt = patch.startsAt === undefined ? current.startsAt : toDate(patch.startsAt);
    const expiresAt = patch.expiresAt === undefined ? current.expiresAt : toDate(patch.expiresAt);
    this.assertWindow(startsAt?.toISOString() ?? null, expiresAt?.toISOString() ?? null);
    if (
      patch.usageLimit !== undefined &&
      patch.usageLimit !== null &&
      patch.usageLimit < current.usedCount
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_FAILED,
        `This code was already used ${String(current.usedCount)} times`,
        [{ path: 'usageLimit', message: `At least ${String(current.usedCount)}` }],
      );
    }
    const [row] = await this.db
      .update(discountCodes)
      .set({
        ...patch,
        startsAt: toDate(patch.startsAt),
        expiresAt: toDate(patch.expiresAt),
      })
      .where(eq(discountCodes.id, id))
      .returning();
    if (!row) throw new DomainError(ErrorCode.NOT_FOUND, 'Discount code not found');
    return this.view(row);
  }

  // ── order-service ──────────────────────────────────────────────────────────

  /**
   * Claims one use of a code for an order. The code row is locked so the usage
   * limit holds under concurrency; retrying with the same order id returns the
   * existing claim instead of using the code twice.
   */
  async redeem(input: {
    code: string;
    orderId: string;
    userId: string | null;
    subtotal: number;
  }): Promise<Redemption> {
    const code = normalizeCode(input.code);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.code, code))
        .for('update');
      if (!row) throw new DomainError(ErrorCode.COUPON_INVALID, 'This code is not valid');

      const [existing] = await tx
        .select()
        .from(discountRedemptions)
        .where(eq(discountRedemptions.orderId, input.orderId));
      if (existing) {
        if (existing.discountCodeId !== row.id) {
          throw new DomainError(ErrorCode.CONFLICT, 'This order already uses another code');
        }
        return this.redemption(input.orderId, row);
      }

      const [{ total } = { total: 0 }] = input.userId
        ? await tx
            .select({ total: count() })
            .from(discountRedemptions)
            .where(
              and(
                eq(discountRedemptions.discountCodeId, row.id),
                eq(discountRedemptions.userId, input.userId),
              ),
            )
        : [];
      const verdict = evaluateCoupon(row, {
        subtotal: input.subtotal,
        now: new Date(),
        userId: input.userId,
        customerUses: total,
      });
      if (!verdict.ok) throw new DomainError(ErrorCode[verdict.reason], verdict.message);

      await tx.insert(discountRedemptions).values({
        orderId: input.orderId,
        discountCodeId: row.id,
        userId: input.userId,
      });
      await tx
        .update(discountCodes)
        .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
        .where(eq(discountCodes.id, row.id));
      this.logger.log(`code ${row.code} redeemed by order ${input.orderId}`);
      return this.redemption(input.orderId, row);
    });
  }

  /** Gives the use back when an order is cancelled or its payment fails. Idempotent. */
  async release(orderId: string): Promise<{ released: boolean }> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(discountRedemptions)
        .where(eq(discountRedemptions.orderId, orderId));
      if (!existing) return { released: false };
      await tx
        .select({ id: discountCodes.id })
        .from(discountCodes)
        .where(eq(discountCodes.id, existing.discountCodeId))
        .for('update');
      const deleted = await tx
        .delete(discountRedemptions)
        .where(eq(discountRedemptions.orderId, orderId))
        .returning();
      // A concurrent release may have won between our read and the lock.
      if (deleted.length === 0) return { released: false };
      await tx
        .update(discountCodes)
        .set({ usedCount: sql`GREATEST(${discountCodes.usedCount} - 1, 0)` })
        .where(eq(discountCodes.id, existing.discountCodeId));
      return { released: true };
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertWindow(startsAt: string | null, expiresAt: string | null): void {
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
      throw new DomainError(ErrorCode.VALIDATION_FAILED, 'The code must expire after it starts', [
        { path: 'expiresAt', message: 'Must be after startsAt' },
      ]);
    }
  }

  private redemption(orderId: string, row: DiscountCodeRow): Redemption {
    return { orderId, discountCodeId: row.id, code: row.code, type: row.type, value: row.value };
  }

  private view(row: DiscountCodeRow): DiscountCode {
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      minSubtotal:
        row.minSubtotal === null ? null : money(row.minSubtotal, row.currency as Currency),
      startsAt: row.startsAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      usageLimit: row.usageLimit,
      perCustomerLimit: row.perCustomerLimit,
      usedCount: row.usedCount,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
