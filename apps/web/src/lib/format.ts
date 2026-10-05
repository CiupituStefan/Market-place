import type { Money } from '@market/types';

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats an amount computed by the backend. Display only: the frontend never
 * does price arithmetic that is sent back to the server.
 */
export function formatMoney(money: Money, locale = 'en-IE'): string {
  return formatterFor(money.currency, locale).format(money.amount / 100);
}

/** Percentage saved between a compare-at price and the current price, for badges. */
export function discountPercent(price: Money, compareAt: Money | null | undefined): number | null {
  if (compareAt?.currency !== price.currency || compareAt.amount <= price.amount) {
    return null;
  }
  return Math.round(((compareAt.amount - price.amount) / compareAt.amount) * 100);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const dateTime = new Intl.DateTimeFormat('en-IE', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('en-IE', { dateStyle: 'medium' });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}
