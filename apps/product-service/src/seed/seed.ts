import type { Product } from '@market/types';
import { eq } from 'drizzle-orm';
import { CatalogWriterService } from '../catalog/catalog-writer.service.js';
import type { CreateProductInput } from '../catalog/dto.js';
import type { AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import {
  categories as categoriesTable,
  configuratorIncompatibilities,
  configuratorOptions,
  configurators,
  products as productsTable,
} from '../db/schema.js';
import { categories, featuredSlugs, products } from './catalog-data.js';
import { CSE_CUSTOM } from './configurator-data.js';

export function toCreateInput(product: Product): CreateProductInput {
  const { brand: _brand, ...attributes } = product.attributes;
  const rank = featuredSlugs.indexOf(product.slug);
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    categorySlug: product.categorySlug,
    kind: product.kind,
    tagline: product.tagline,
    description: product.description,
    highlights: product.highlights,
    included: product.included,
    compatibility: product.compatibility,
    faq: product.faq,
    specs: product.specs,
    badges: product.badges,
    preview: product.preview,
    options: product.options,
    attributes,
    featuredRank: rank === -1 ? null : rank,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      options: variant.options,
      price: variant.price.amount,
      compareAtPrice: variant.compareAtPrice?.amount ?? null,
      availability: variant.availability,
      preview: variant.preview,
    })),
  };
}

/**
 * Idempotent demo seed: categories, published products (with demo ratings and
 * publish dates) and the CSE Custom configurator. Existing slugs are skipped.
 */
export async function seedCatalog(
  db: Database,
  config: AppConfig,
): Promise<{ created: number; skipped: number }> {
  const writer = new CatalogWriterService(db, config);
  const existingCategories = new Set(
    (await db.select({ slug: categoriesTable.slug }).from(categoriesTable)).map((c) => c.slug),
  );
  // Parents first so children can reference them.
  for (const category of [...categories].sort(
    (a, b) => Number(a.parentSlug !== null) - Number(b.parentSlug !== null),
  )) {
    if (existingCategories.has(category.slug)) continue;
    await writer.createCategory({
      slug: category.slug,
      name: category.name,
      description: category.description,
      parentSlug: category.parentSlug,
      preview: category.preview,
      position: categories.indexOf(category),
    });
  }

  let created = 0;
  let skipped = 0;
  for (const product of products) {
    const [existing] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.slug, product.slug));
    if (existing) {
      skipped += 1;
      continue;
    }
    const id = await writer.create(toCreateInput(product));
    await writer.setStatus(id, 'PUBLISHED');
    // Demo-only projections that normally come from review-service and the publish time.
    await db
      .update(productsTable)
      .set({
        ratingAverage: product.rating.average,
        ratingCount: product.rating.count,
        publishedAt: new Date(product.createdAt),
      })
      .where(eq(productsTable.id, id));
    created += 1;
  }

  await seedConfigurator(db);
  return { created, skipped };
}

async function seedConfigurator(db: Database): Promise<void> {
  const [existing] = await db
    .select({ id: configurators.id })
    .from(configurators)
    .where(eq(configurators.slug, CSE_CUSTOM.slug));
  if (existing) return;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(configurators)
      .values({
        slug: CSE_CUSTOM.slug,
        name: CSE_CUSTOM.name,
        description: CSE_CUSTOM.description,
        skuPrefix: CSE_CUSTOM.skuPrefix,
        basePriceAmount: CSE_CUSTOM.basePrice,
        currency: 'EUR',
        basePreview: CSE_CUSTOM.basePreview,
      })
      .returning({ id: configurators.id });
    if (!row) throw new Error('configurator insert returned no row');
    await tx.insert(configuratorOptions).values(
      CSE_CUSTOM.options.map((option, position) => ({
        ...option,
        configuratorId: row.id,
        position,
      })),
    );
    await tx
      .insert(configuratorIncompatibilities)
      .values(CSE_CUSTOM.incompatibilities.map((rule) => ({ ...rule, configuratorId: row.id })));
  });
}
