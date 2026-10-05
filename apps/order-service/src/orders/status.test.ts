import { ORDER_STATUSES } from '@market/types';
import { describe, expect, it } from 'vitest';
import { includedVat, VAT_RATES_BPS } from '../tax/vat.js';
import { assertTransition, canTransition, isCustomerVisible } from './status.js';

describe('order state machine', () => {
  it('follows the happy path', () => {
    const path = [
      'PENDING',
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
    ] as const;
    for (let i = 1; i < path.length; i += 1)
      expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
  });

  it('never leaves a final state', () => {
    for (const final of ['CANCELLED', 'REFUNDED', 'FAILED'] as const) {
      for (const to of ORDER_STATUSES) expect(canTransition(final, to)).toBe(false);
    }
  });

  it('cannot skip payment or shipping', () => {
    expect(canTransition('PENDING_PAYMENT', 'SHIPPED')).toBe(false);
    expect(canTransition('PAID', 'DELIVERED')).toBe(false);
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(() => {
      assertTransition('DELIVERED', 'PAID');
    }).toThrow(/delivered cannot become paid/);
  });

  it('hides internal checkout states from customers', () => {
    expect(isCustomerVisible('PENDING')).toBe(false);
    expect(isCustomerVisible('FAILED')).toBe(false);
    expect(isCustomerVisible('PENDING_PAYMENT')).toBe(true);
  });
});

describe('VAT', () => {
  it('extracts the VAT included in a gross amount, half-up', () => {
    expect(includedVat(121_00, 2_100)).toBe(21_00);
    expect(includedVat(119_00, 1_900)).toBe(19_00);
    expect(includedVat(100, 2_550)).toBe(20); // 20.32 → 20
    expect(includedVat(0, 2_100)).toBe(0);
  });

  it('covers every shipping country with a plausible rate', () => {
    for (const rate of Object.values(VAT_RATES_BPS)) {
      expect(rate).toBeGreaterThanOrEqual(1_500);
      expect(rate).toBeLessThanOrEqual(2_700);
    }
  });
});
