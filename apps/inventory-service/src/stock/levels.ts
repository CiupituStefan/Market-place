import { DomainError, ErrorCode } from '@market/types';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export const MAX_LINE_QUANTITY = 100;
export const MAX_LINES = 50;

export function availableOf(item: { onHand: number; reserved: number }): number {
  return Math.max(0, item.onHand - item.reserved);
}

export function stockStatus(available: number, lowStockThreshold: number): StockStatus {
  if (available <= 0) return 'OUT_OF_STOCK';
  return available <= lowStockThreshold ? 'LOW_STOCK' : 'IN_STOCK';
}

export interface Line {
  variantId: string;
  quantity: number;
}

/**
 * Merges duplicate variants and sorts by variant id. Locking rows in this one
 * global order is what prevents deadlocks between concurrent multi-line
 * reservations (A,B vs B,A would otherwise wait on each other forever).
 */
export function normalizeLines(lines: readonly Line[]): Line[] {
  const totals = new Map<string, number>();
  for (const line of lines)
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  const merged = [...totals.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));
  const tooMany = merged.filter((line) => line.quantity > MAX_LINE_QUANTITY);
  if (merged.length === 0 || merged.length > MAX_LINES || tooMany.length > 0) {
    throw new DomainError(ErrorCode.VALIDATION_FAILED, 'Invalid reservation lines', [
      ...(merged.length === 0 ? [{ path: 'lines', message: 'At least one line is required' }] : []),
      ...(merged.length > MAX_LINES
        ? [{ path: 'lines', message: `At most ${MAX_LINES} lines` }]
        : []),
      ...tooMany.map((line) => ({
        path: line.variantId,
        message: `At most ${MAX_LINE_QUANTITY} per line`,
      })),
    ]);
  }
  return merged;
}

export function sameLines(a: readonly Line[], b: readonly Line[]): boolean {
  const key = (lines: readonly Line[]) =>
    lines
      .map((line) => `${line.variantId}:${line.quantity}`)
      .sort()
      .join(',');
  return key(a) === key(b);
}
