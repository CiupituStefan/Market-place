import type { Currency } from '@market/types';
import { formatMoney } from '@/lib/format';

export const money = (amount: number, currency: Currency = 'EUR') =>
  formatMoney({ amount, currency });

/** Axis labels: whole units, compact past ten thousand. */
export function compactMoney(amount: number, currency: Currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    notation: amount >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export const count = (n: number) => new Intl.NumberFormat('en-IE').format(n);
