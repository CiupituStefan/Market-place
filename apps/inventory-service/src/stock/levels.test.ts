import { describe, expect, it } from 'vitest';
import { availableOf, normalizeLines, sameLines, stockStatus } from './levels.js';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

describe('stock levels', () => {
  it('computes availability and status', () => {
    expect(availableOf({ onHand: 10, reserved: 4 })).toBe(6);
    expect(stockStatus(0, 5)).toBe('OUT_OF_STOCK');
    expect(stockStatus(5, 5)).toBe('LOW_STOCK');
    expect(stockStatus(6, 5)).toBe('IN_STOCK');
  });

  it('merges duplicates and sorts by variant id (deadlock-free lock order)', () => {
    expect(
      normalizeLines([
        { variantId: B, quantity: 1 },
        { variantId: A, quantity: 2 },
        { variantId: B, quantity: 3 },
      ]),
    ).toEqual([
      { variantId: A, quantity: 2 },
      { variantId: B, quantity: 4 },
    ]);
  });

  it('rejects empty and oversized requests', () => {
    expect(() => normalizeLines([])).toThrow(/Invalid reservation lines/);
    expect(() =>
      normalizeLines([
        { variantId: A, quantity: 60 },
        { variantId: A, quantity: 60 },
      ]),
    ).toThrow();
  });

  it('compares requests regardless of order', () => {
    expect(
      sameLines(
        [
          { variantId: A, quantity: 1 },
          { variantId: B, quantity: 2 },
        ],
        [
          { variantId: B, quantity: 2 },
          { variantId: A, quantity: 1 },
        ],
      ),
    ).toBe(true);
    expect(sameLines([{ variantId: A, quantity: 1 }], [{ variantId: A, quantity: 2 }])).toBe(false);
  });
});
