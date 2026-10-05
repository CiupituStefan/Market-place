import { describe, expect, it } from 'vitest';
import { discountPercent, formatMoney, pluralize } from './format';

const eur = (amount: number) => ({ amount, currency: 'EUR' as const });

describe('formatMoney', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(eur(18900))).toBe('€189.00');
    expect(formatMoney({ amount: 4999, currency: 'RON' }, 'ro-RO')).toMatch(/^49,99\sRON$/);
  });
});

describe('discountPercent', () => {
  it('returns the rounded percentage saved', () => {
    expect(discountPercent(eur(14900), eur(16900))).toBe(12);
  });

  it('returns null when there is no real discount', () => {
    expect(discountPercent(eur(100), null)).toBeNull();
    expect(discountPercent(eur(100), eur(100))).toBeNull();
    expect(discountPercent(eur(100), eur(90))).toBeNull();
    expect(discountPercent(eur(100), { amount: 200, currency: 'USD' })).toBeNull();
  });
});

describe('pluralize', () => {
  it('handles singular and plural', () => {
    expect(pluralize(1, 'product')).toBe('1 product');
    expect(pluralize(3, 'product')).toBe('3 products');
  });
});
