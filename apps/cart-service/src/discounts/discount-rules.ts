import type { DiscountCodeRow } from '../db/schema.js';

export type CouponVerdict =
  { ok: true } | { ok: false; reason: 'COUPON_INVALID' | 'COUPON_EXPIRED'; message: string };

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Whether a code can be used right now. Re-evaluated on every cart read and
 * again, under a row lock, when an order claims it.
 */
export function evaluateCoupon(
  code: DiscountCodeRow,
  context: { subtotal: number; now: Date; userId: string | null; customerUses: number },
): CouponVerdict {
  if (!code.active)
    return { ok: false, reason: 'COUPON_INVALID', message: 'This code is not valid' };
  if (code.startsAt && context.now < code.startsAt) {
    return { ok: false, reason: 'COUPON_INVALID', message: 'This code is not active yet' };
  }
  if (code.expiresAt && context.now >= code.expiresAt) {
    return { ok: false, reason: 'COUPON_EXPIRED', message: 'This code has expired' };
  }
  if (code.usageLimit !== null && code.usedCount >= code.usageLimit) {
    return { ok: false, reason: 'COUPON_EXPIRED', message: 'This code has been fully redeemed' };
  }
  if (code.perCustomerLimit !== null) {
    if (!context.userId)
      return { ok: false, reason: 'COUPON_INVALID', message: 'Sign in to use this code' };
    if (context.customerUses >= code.perCustomerLimit) {
      return { ok: false, reason: 'COUPON_INVALID', message: 'You have already used this code' };
    }
  }
  if (code.minSubtotal !== null && context.subtotal < code.minSubtotal) {
    const minimum = (code.minSubtotal / 100).toFixed(2);
    return {
      ok: false,
      reason: 'COUPON_INVALID',
      message: `This code needs a subtotal of at least ${minimum} ${code.currency}`,
    };
  }
  return { ok: true };
}
