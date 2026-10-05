import { describe, expect, it } from 'vitest';
import type { DiscountCodeRow } from '../db/schema.js';
import { evaluateCoupon, normalizeCode } from '../discounts/discount-rules.js';
import { priceCart, type PricingSettings } from './pricing.js';

const settings: PricingSettings = {
  currency: 'EUR',
  vatRateBps: 2100,
  freeShippingThreshold: 99_00,
  shippingFlatRate: 6_90,
};
const amounts = (t: ReturnType<typeof priceCart>) => ({
  subtotal: t.subtotal.amount,
  discount: t.discount.amount,
  shipping: t.shipping.amount,
  tax: t.tax.amount,
  total: t.total.amount,
});

describe('priceCart', () => {
  it('charges nothing for an empty cart', () => {
    expect(amounts(priceCart([], null, settings))).toEqual({
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
    });
  });

  it('adds flat shipping below the threshold and extracts included VAT', () => {
    // 2 × 19.00 = 38.00 + 6.90 shipping = 44.90; VAT 21% included = 44.90 × 21/121 = 7.79
    expect(amounts(priceCart([{ unitPrice: 19_00, quantity: 2 }], null, settings))).toEqual({
      subtotal: 38_00,
      discount: 0,
      shipping: 6_90,
      tax: 7_79,
      total: 44_90,
    });
  });

  it('ships free from the threshold, judged after the discount', () => {
    expect(priceCart([{ unitPrice: 99_00, quantity: 1 }], null, settings).shipping.amount).toBe(0);
    // 10% off 105.00 = 94.50 → below 99.00, so shipping applies again.
    const discounted = priceCart(
      [{ unitPrice: 105_00, quantity: 1 }],
      { type: 'PERCENTAGE', value: 1_000 },
      settings,
    );
    expect(amounts(discounted)).toMatchObject({ discount: 10_50, shipping: 6_90, total: 101_40 });
  });

  it('rounds percentage discounts half-up to the cent', () => {
    // 15% of 129.99 = 19.4985 → 19.50
    expect(
      priceCart(
        [{ unitPrice: 129_99, quantity: 1 }],
        { type: 'PERCENTAGE', value: 1_500 },
        settings,
      ).discount.amount,
    ).toBe(19_50);
  });

  it('caps fixed discounts at the subtotal (never a negative total)', () => {
    const totals = priceCart(
      [{ unitPrice: 5_00, quantity: 1 }],
      { type: 'FIXED', value: 20_00 },
      settings,
    );
    expect(amounts(totals)).toMatchObject({ discount: 5_00, shipping: 6_90, total: 6_90 });
  });

  it('keeps every amount an integer', () => {
    const totals = priceCart(
      [
        { unitPrice: 33_33, quantity: 3 },
        { unitPrice: 1, quantity: 7 },
      ],
      { type: 'PERCENTAGE', value: 333 },
      settings,
    );
    for (const value of Object.values(amounts(totals))) expect(Number.isInteger(value)).toBe(true);
  });
});

function code(overrides: Partial<DiscountCodeRow> = {}): DiscountCodeRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'WELCOME10',
    type: 'PERCENTAGE',
    value: 1_000,
    currency: 'EUR',
    minSubtotal: null,
    startsAt: null,
    expiresAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    usedCount: 0,
    active: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const now = new Date('2026-10-05T12:00:00Z');
const ctx = { subtotal: 100_00, now, userId: null, customerUses: 0 };

describe('evaluateCoupon', () => {
  it('accepts a plain active code', () => {
    expect(evaluateCoupon(code(), ctx)).toEqual({ ok: true });
  });

  it.each([
    ['inactive', code({ active: false }), 'This code is not valid'],
    ['not started', code({ startsAt: new Date('2026-11-01') }), 'This code is not active yet'],
    ['expired', code({ expiresAt: now }), 'This code has expired'],
    ['used up', code({ usageLimit: 5, usedCount: 5 }), 'This code has been fully redeemed'],
    [
      'below minimum',
      code({ minSubtotal: 150_00 }),
      'This code needs a subtotal of at least 150.00 EUR',
    ],
    ['per-customer for a guest', code({ perCustomerLimit: 1 }), 'Sign in to use this code'],
  ])('rejects %s', (_label, row, message) => {
    expect(evaluateCoupon(row, ctx)).toMatchObject({ ok: false, message });
  });

  it('enforces per-customer limits for signed-in users', () => {
    const limited = code({ perCustomerLimit: 1 });
    expect(evaluateCoupon(limited, { ...ctx, userId: 'u1', customerUses: 0 })).toEqual({
      ok: true,
    });
    expect(evaluateCoupon(limited, { ...ctx, userId: 'u1', customerUses: 1 })).toMatchObject({
      ok: false,
    });
  });

  it('normalises typed codes', () => {
    expect(normalizeCode('  welcome10 ')).toBe('WELCOME10');
  });
});
