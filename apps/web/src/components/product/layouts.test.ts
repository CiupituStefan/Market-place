import { describe, expect, it } from 'vitest';
import { KEYBOARD_LAYOUTS } from '@/lib/catalog/schemas';
import { layoutKeys } from './layouts';

describe('keyboard layouts', () => {
  it.each([
    ['60%', 61, 15],
    ['65%', 68, 16],
    ['75%', 83, 16],
    ['TKL', 87, 18.25],
  ] as const)('%s has %i keys and is %f units wide', (layout, keys, width) => {
    const result = layoutKeys(layout);
    expect(result.keys).toHaveLength(keys);
    expect(result.width).toBe(width);
  });

  it('never overlaps keys within a row', () => {
    for (const layout of KEYBOARD_LAYOUTS) {
      const { keys } = layoutKeys(layout);
      const rows = new Map<number, typeof keys>();
      for (const key of keys) rows.set(key.y, [...(rows.get(key.y) ?? []), key]);
      for (const row of rows.values()) {
        for (let i = 1; i < row.length; i += 1) {
          expect(row[i]!.x).toBeGreaterThanOrEqual(row[i - 1]!.x + row[i - 1]!.w);
        }
      }
    }
  });

  it('marks exactly one spacebar per layout', () => {
    for (const layout of KEYBOARD_LAYOUTS) {
      expect(layoutKeys(layout).keys.filter((k) => k.role === 'space')).toHaveLength(1);
    }
  });
});
