import { describe, expect, it } from 'vitest';
import { formText, parseAmount, toAmountInput } from './admin-page';
import { addDays, presetRange, storeToday } from './date-range';
import { niceTicks } from './sales-chart';

describe('admin helpers', () => {
  it('parses money typed by staff into minor units, or rejects it', () => {
    expect(parseAmount('149')).toBe(14_900);
    expect(parseAmount('149.5')).toBe(14_950);
    expect(parseAmount('0,99')).toBe(99);
    expect(parseAmount('1.999')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('ten')).toBeNull();
    expect(toAmountInput(14_950)).toBe('149.50');
    expect(toAmountInput(null)).toBe('');
  });

  it('reads trimmed text fields and ignores files', () => {
    const data = new FormData();
    data.set('name', '  Forge 75 ');
    data.set('file', new Blob(['x']));
    expect(formText(data, 'name')).toBe('Forge 75');
    expect(formText(data, 'file')).toBe('');
    expect(formText(data, 'missing')).toBe('');
  });

  it('builds store-local date ranges', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(presetRange('7d', '2026-10-05')).toEqual({ from: '2026-09-29', to: '2026-10-05' });
    expect(presetRange('today', '2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    // 23:30 UTC on 4 October is already 5 October in Bucharest.
    expect(storeToday(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05');
  });

  it('picks clean, round axis ticks that cover the maximum', () => {
    expect(niceTicks(74_600)).toEqual([0, 20_000, 40_000, 60_000, 80_000]);
    expect(niceTicks(5)).toEqual([0, 2, 4, 6]);
    expect(niceTicks(0)).toEqual([0]);
  });
});
