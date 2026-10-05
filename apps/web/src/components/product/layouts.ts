import type { KeyboardLayout } from '@/lib/catalog/schemas';

/**
 * Key rows per layout in key units (1u = one standard key). Negative numbers are
 * horizontal gaps. `null` is a quarter-unit vertical gap (e.g. under the F-row).
 */
export type Row = number[] | null;

const ones = (n: number) => Array.from({ length: n }, () => 1);

const ROWS_60: Row[] = [
  [...ones(13), 2],
  [1.5, ...ones(12), 1.5],
  [1.75, ...ones(11), 2.25],
  [2.25, ...ones(10), 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
];

const ROWS_65: Row[] = [
  [...ones(13), 2, 1],
  [1.5, ...ones(12), 1.5, 1],
  [1.75, ...ones(11), 2.25, 1],
  [2.25, ...ones(10), 1.75, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1, 1],
];

const ROWS_75: Row[] = [
  [1, -0.25, ...ones(4), -0.25, ...ones(4), -0.25, ...ones(4), -0.25, 1, 1],
  null,
  ...ROWS_65,
];

const TKL_F: number[] = [1, -1, ...ones(4), -0.5, ...ones(4), -0.5, ...ones(4), -0.25, 1, 1, 1];
const ROWS_TKL: Row[] = [
  TKL_F,
  null,
  [...ones(13), 2, -0.25, 1, 1, 1],
  [1.5, ...ones(12), 1.5, -0.25, 1, 1, 1],
  [1.75, ...ones(11), 2.25],
  [2.25, ...ones(10), 2.75, -1.25, 1],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25, -0.25, 1, 1, 1],
];

const ROWS_100: Row[] = [
  [...TKL_F, -4.25],
  null,
  [...ones(13), 2, -0.25, 1, 1, 1, -0.25, 1, 1, 1, 1],
  [1.5, ...ones(12), 1.5, -0.25, 1, 1, 1, -0.25, 1, 1, 1, 1],
  [1.75, ...ones(11), 2.25, -3.5, 1, 1, 1, 1],
  [2.25, ...ones(10), 2.75, -1.25, 1, -1.25, 1, 1, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25, -0.25, 1, 1, 1, -0.25, 2, 1, 1],
];

const ROWS_96: Row[] = [
  ones(19),
  [...ones(13), 2, 1, 1, 1, 1],
  [1.5, ...ones(12), 1.5, 1, 1, 1, 1],
  [1.75, ...ones(11), 2.25, 1, 1, 1, 1],
  [2.25, ...ones(10), 1.75, 1, 1, 1, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const LAYOUT_ROWS: Record<KeyboardLayout, Row[]> = {
  '60%': ROWS_60,
  '65%': ROWS_65,
  '75%': ROWS_75,
  TKL: ROWS_TKL,
  '96%': ROWS_96,
  '100%': ROWS_100,
};

export interface KeyRect {
  x: number;
  y: number;
  w: number;
  /** Key role, used for coloring. */
  role: 'alpha' | 'mod' | 'accent' | 'space';
}

/** Expands rows into positioned keys (in units) and the overall size. */
export function layoutKeys(layout: KeyboardLayout): {
  keys: KeyRect[];
  width: number;
  height: number;
} {
  const keys: KeyRect[] = [];
  let y = 0;
  let width = 0;
  let firstKey = true;
  for (const row of LAYOUT_ROWS[layout]) {
    if (row === null) {
      y += 0.25;
      continue;
    }
    let x = 0;
    const isHomeRow = row[0] === 1.75;
    for (const w of row) {
      if (w <= 0) {
        x += -w;
        continue;
      }
      let role: KeyRect['role'] = 'alpha';
      if (w >= 6) role = 'space';
      else if (firstKey || (isHomeRow && w === 2.25))
        role = 'accent'; // Esc and Enter
      else if (w > 1) role = 'mod';
      keys.push({ x, y, w, role });
      firstKey = false;
      x += w;
    }
    width = Math.max(width, x);
    y += 1;
  }
  return { keys, width, height: y };
}
