import type {
  Badge,
  Category,
  Currency,
  Money,
  Product,
  ProductImage,
  ProductSummary,
  Variant,
} from '@market/types';
import type { CategoryRow, ImageRow, ProductRow, VariantRow } from '../db/schema.js';

export function money(amount: number, currency: string): Money {
  return { amount, currency: currency as Currency };
}

export function toImage(row: ImageRow): ProductImage {
  return { url: row.url, alt: row.alt, width: row.width, height: row.height };
}

export function groupAttributes(
  rows: readonly { key: string; value: string }[],
): Record<string, string[]> {
  const attributes: Record<string, string[]> = {};
  for (const row of rows) (attributes[row.key] ??= []).push(row.value);
  for (const values of Object.values(attributes))
    values.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return attributes;
}

export function toSummary(
  product: ProductRow,
  categorySlug: string,
  images: readonly ImageRow[],
  attributes: Record<string, string[]>,
): ProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    categorySlug,
    kind: product.kind,
    tagline: product.tagline,
    price: money(product.minPriceAmount ?? 0, product.currency),
    compareAtPrice:
      product.minPriceCompareAtAmount === null
        ? null
        : money(product.minPriceCompareAtAmount, product.currency),
    rating: { average: Math.round(product.ratingAverage * 10) / 10, count: product.ratingCount },
    badges: product.badges as Badge[],
    availability: product.availability,
    attributes,
    images: images.filter((image) => image.variantId === null).map(toImage),
    preview: product.preview,
    createdAt: (product.publishedAt ?? product.createdAt).toISOString(),
  };
}

export function toVariant(row: VariantRow, images: readonly ImageRow[]): Variant {
  return {
    id: row.id,
    sku: row.sku,
    options: row.options,
    price: money(row.priceAmount, row.currency),
    compareAtPrice: row.compareAtAmount === null ? null : money(row.compareAtAmount, row.currency),
    availability: row.availability,
    preview: row.preview,
    images: images.filter((image) => image.variantId === row.id).map(toImage),
  };
}

export function toProduct(
  product: ProductRow,
  categorySlug: string,
  variants: readonly VariantRow[],
  images: readonly ImageRow[],
  attributes: Record<string, string[]>,
): Product {
  return {
    ...toSummary(product, categorySlug, images, attributes),
    description: product.description,
    highlights: product.highlights,
    options: product.options,
    variants: [...variants]
      .sort((a, b) => a.position - b.position)
      .map((variant) => toVariant(variant, images)),
    specs: product.specs,
    included: product.included,
    compatibility: product.compatibility,
    faq: product.faq,
  };
}

export function toCategory(row: CategoryRow, parentSlug: string | null): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    parentSlug,
    preview: row.preview,
  };
}
