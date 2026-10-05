import { DomainError, ErrorCode, type Availability } from '@market/types';
import type { OptionDefinition } from './dto.js';

/**
 * Pure rules for derived catalog data. Kept free of I/O so they are trivially
 * unit-tested; the writer service applies them on every change.
 */

const AVAILABILITY_ORDER: Availability[] = ['IN_STOCK', 'LOW_STOCK', 'PREORDER', 'OUT_OF_STOCK'];

/** A product is as available as its most available variant. */
export function rollupAvailability(
  variants: readonly { availability: Availability }[],
): Availability {
  for (const level of AVAILABILITY_ORDER) {
    if (variants.some((variant) => variant.availability === level)) return level;
  }
  return 'OUT_OF_STOCK';
}

/** The "from" price shown in listings: the cheapest variant, with its compare-at price. */
export function lowestPrice(
  variants: readonly { priceAmount: number; compareAtAmount: number | null }[],
): { amount: number; compareAt: number | null } | null {
  let best: { amount: number; compareAt: number | null } | null = null;
  for (const variant of variants) {
    if (!best || variant.priceAmount < best.amount) {
      best = { amount: variant.priceAmount, compareAt: variant.compareAtAmount };
    }
  }
  return best;
}

/** Everything a shopper might type to find the product, lower-cased for search. */
export function buildSearchDocument(input: {
  name: string;
  brand: string;
  tagline: string;
  categoryNames: readonly string[];
  skus: readonly string[];
  attributes: Readonly<Record<string, readonly string[]>>;
}): string {
  return [
    input.name,
    input.brand,
    input.tagline,
    ...input.categoryNames,
    ...input.skus,
    ...Object.values(input.attributes).flat(),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Every variant must pick exactly one known value per option, and no two variants
 * may share a combination (otherwise the storefront could not select between them).
 */
export function assertVariantsMatchOptions(
  options: readonly OptionDefinition[],
  variants: readonly { sku: string; options: Record<string, string> }[],
): void {
  const keys = options.map((option) => option.key);
  const seenCombinations = new Map<string, string>();
  const seenSkus = new Set<string>();
  const details: { path: string; message: string }[] = [];

  if (new Set(keys).size !== keys.length)
    details.push({ path: 'options', message: 'Option keys must be unique' });

  variants.forEach((variant, index) => {
    if (seenSkus.has(variant.sku))
      details.push({ path: `variants.${index}.sku`, message: 'Duplicate SKU' });
    seenSkus.add(variant.sku);

    const given = Object.keys(variant.options);
    const unknown = given.filter((key) => !keys.includes(key));
    if (unknown.length > 0 || given.length !== keys.length) {
      details.push({
        path: `variants.${index}.options`,
        message: `Must set exactly these options: ${keys.join(', ') || '(none)'}`,
      });
      return;
    }
    for (const option of options) {
      const value = variant.options[option.key];
      if (!option.values.some((v) => v.value === value)) {
        details.push({
          path: `variants.${index}.options.${option.key}`,
          message: `Unknown value "${String(value)}"`,
        });
      }
    }
    const combination = keys.map((key) => `${key}=${variant.options[key] ?? ''}`).join('&');
    const other = seenCombinations.get(combination);
    if (other)
      details.push({ path: `variants.${index}.options`, message: `Same options as ${other}` });
    seenCombinations.set(combination, variant.sku);
  });

  if (details.length > 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_FAILED,
      'Variants do not match the product options',
      details,
    );
  }
}
