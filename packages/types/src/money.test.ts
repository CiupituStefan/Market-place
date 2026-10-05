import { describe, expect, it } from 'vitest';
import {
  add,
  CurrencyMismatchError,
  money,
  multiply,
  percentage,
  subtractClamped,
  sum,
} from './money.js';

describe('money', () => {
  it('adds amounts in the same currency', () => {
    expect(add(money(1999, 'EUR'), money(1, 'EUR'))).toEqual({ amount: 2000, currency: 'EUR' });
  });

  it('refuses to mix currencies', () => {
    expect(() => add(money(1, 'EUR'), money(1, 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('rejects fractional minor units', () => {
    expect(() => money(10.5, 'EUR')).toThrow(RangeError);
  });

  it('multiplies by integer quantities only', () => {
    expect(multiply(money(12999, 'EUR'), 3).amount).toBe(38997);
    expect(() => multiply(money(100, 'EUR'), 1.5)).toThrow(RangeError);
    expect(() => multiply(money(100, 'EUR'), -1)).toThrow(RangeError);
  });

  it('computes percentages in basis points with half-up rounding', () => {
    expect(percentage(money(12999, 'EUR'), 1000).amount).toBe(1300); // 1299.9 -> 1300
    expect(percentage(money(5, 'EUR'), 1000).amount).toBe(1); // 0.5 -> 1
    expect(() => percentage(money(100, 'EUR'), 10_001)).toThrow(RangeError);
  });

  it('never lets a subtraction go below zero', () => {
    expect(subtractClamped(money(500, 'EUR'), money(800, 'EUR')).amount).toBe(0);
  });

  it('sums a list', () => {
    expect(sum([money(100, 'RON'), money(250, 'RON')], 'RON').amount).toBe(350);
    expect(sum([], 'RON').amount).toBe(0);
  });
});
