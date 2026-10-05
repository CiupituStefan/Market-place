import type { Availability, Product, Variant } from './schemas';

export type Selection = Record<string, string>;

export function findVariant(product: Product, selection: Selection): Variant | undefined {
  return product.variants.find((variant) =>
    product.options.every((option) => variant.options[option.key] === selection[option.key]),
  );
}

/** Initial selection: the first purchasable variant, else the first variant. */
export function defaultSelection(product: Product): Selection {
  const variant =
    product.variants.find((v) => v.availability !== 'OUT_OF_STOCK') ?? product.variants[0];
  return { ...(variant?.options ?? {}) };
}

/**
 * Availability of an option value given the other current selections: lets the
 * picker mark combinations that do not exist or are sold out.
 */
export function valueAvailability(
  product: Product,
  selection: Selection,
  optionKey: string,
  value: string,
): Availability | 'UNAVAILABLE' {
  const variant = findVariant(product, { ...selection, [optionKey]: value });
  return variant ? variant.availability : 'UNAVAILABLE';
}

/**
 * Selecting a value may produce a combination that does not exist. In that case
 * keep the new value and pick the closest existing variant for the other options.
 */
export function selectValue(
  product: Product,
  selection: Selection,
  optionKey: string,
  value: string,
): Selection {
  const next = { ...selection, [optionKey]: value };
  if (findVariant(product, next)) return next;
  const fallback =
    product.variants.find(
      (v) => v.options[optionKey] === value && v.availability !== 'OUT_OF_STOCK',
    ) ?? product.variants.find((v) => v.options[optionKey] === value);
  return fallback ? { ...fallback.options } : next;
}

export function availabilityLabel(availability: Availability): string {
  switch (availability) {
    case 'IN_STOCK':
      return 'In stock — ships in 1–2 business days';
    case 'LOW_STOCK':
      return 'Low stock — order soon';
    case 'PREORDER':
      return 'Pre-order — ships when restocked';
    case 'OUT_OF_STOCK':
      return 'Out of stock';
  }
}
