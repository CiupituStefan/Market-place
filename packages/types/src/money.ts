import { z } from 'zod';

/**
 * Supported ISO-4217 currencies. Prices are always stored and transported in
 * minor units (cents) as integers to avoid floating point errors.
 */
export const CURRENCIES = ['EUR', 'USD', 'RON'] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export const MoneySchema = z.object({
  /** Amount in minor units (e.g. 12999 = 129.99). */
  amount: z.int().nonnegative(),
  currency: CurrencySchema,
});
export type Money = z.infer<typeof MoneySchema>;

export class CurrencyMismatchError extends Error {
  constructor(a: Currency, b: Currency) {
    super(`Cannot combine amounts in different currencies: ${a} and ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Money amount must be a safe integer of minor units, got ${amount}`);
  }
}

export function money(amount: number, currency: Currency): Money {
  assertMinorUnits(amount);
  return { amount, currency };
}

export function zero(currency: Currency): Money {
  return { amount: 0, currency };
}

export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  return money(a.amount + b.amount, a.currency);
}

/** Subtracts b from a, clamping at zero (a total can never become negative). */
export function subtractClamped(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  return money(Math.max(0, a.amount - b.amount), a.currency);
}

export function multiply(a: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, got ${quantity}`);
  }
  return money(a.amount * quantity, a.currency);
}

/**
 * Returns `basisPoints / 10_000` of the amount, rounded half-up to the nearest
 * minor unit. 2000 bps = 20%. Using basis points keeps percentages integral.
 */
export function percentage(a: Money, basisPoints: number): Money {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new RangeError(`Basis points must be an integer in [0, 10000], got ${basisPoints}`);
  }
  return money(Math.round((a.amount * basisPoints) / 10_000), a.currency);
}

export function sum(items: readonly Money[], currency: Currency): Money {
  return items.reduce<Money>((acc, item) => add(acc, item), zero(currency));
}
