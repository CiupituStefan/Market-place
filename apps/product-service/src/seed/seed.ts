import type { Product } from '@market/types';
import { eq } from 'drizzle-orm';
import { CatalogWriterService } from '../catalog/catalog-writer.service.js';
import type { CreateProductInput } from '../catalog/dto.js';
import type { CategoryTranslations, ProductTranslations } from '../catalog/translations.js';
import type { AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import {
  categories as categoriesTable,
  configuratorIncompatibilities,
  configuratorOptions,
  configurators,
  products as productsTable,
  productVariants as productVariantsTable,
} from '../db/schema.js';
import { categories, featuredSlugs, products } from './catalog-data.js';
import { romanianCategories, romanianConfigurator, romanianProduct } from './catalog-data.ro.js';
import { CSE_CUSTOM } from './configurator-data.js';

function productTranslations(product: Product): ProductTranslations {
  const ro = romanianProduct(product);
  return ro ? { ro } : {};
}

function categoryTranslations(slug: string): CategoryTranslations {
  const ro = romanianCategories[slug];
  return ro ? { ro } : {};
}

const isEmpty = (value: object) => Object.keys(value).length === 0;

/**
 * Demo merchandising: made-up star ratings and review counts, BESTSELLER / LIMITED / SALE / NEW
 * badges and "was" (compare-at) prices. Fine for local development and tests, but on a site
 * real people visit they would be fake reviews and fake reference prices (EU consumer law), so
 * deployments seed without them (SEED_DEMO_MERCHANDISING=false).
 */
export interface SeedOptions {
  demoMerchandising: boolean;
}

export function toCreateInput(
  product: Product,
  options: SeedOptions = { demoMerchandising: true },
): CreateProductInput {
  const demo = options.demoMerchandising;
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
    badges: demo ? product.badges : [],
    preview: product.preview,
    options: product.options,
    attributes,
    featuredRank: rank === -1 ? null : rank,
    translations: productTranslations(product),
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      options: variant.options,
      price: variant.price.amount,
      compareAtPrice: demo ? (variant.compareAtPrice?.amount ?? null) : null,
      availability: variant.availability,
      preview: variant.preview,
    })),
  };
}

/**
 * Idempotent demo seed: categories, published products (with demo ratings and
 * publish dates) and the CSE Custom configurator. Existing slugs are skipped, except that
 * rows without translations get the demo ones (catalogs seeded before translations existed).
 */
export async function seedCatalog(
  db: Database,
  config: AppConfig,
  options: SeedOptions = { demoMerchandising: true },
): Promise<{ created: number; skipped: number }> {
  const writer = new CatalogWriterService(db, config);
  const existingCategories = new Map(
    (
      await db
        .select({
          id: categoriesTable.id,
          slug: categoriesTable.slug,
          translations: categoriesTable.translations,
        })
        .from(categoriesTable)
    ).map((c) => [c.slug, c]),
  );
  // Parents first so children can reference them.
  for (const category of [...categories].sort(
    (a, b) => Number(a.parentSlug !== null) - Number(b.parentSlug !== null),
  )) {
    const existing = existingCategories.get(category.slug);
    if (existing) {
      const translations = categoryTranslations(category.slug);
      if (isEmpty(existing.translations) && !isEmpty(translations))
        await writer.updateCategory(existing.id, { translations });
      continue;
    }
    await writer.createCategory({
      slug: category.slug,
      name: category.name,
      description: category.description,
      parentSlug: category.parentSlug,
      preview: category.preview,
      position: categories.indexOf(category),
      translations: categoryTranslations(category.slug),
    });
  }

  let created = 0;
  let skipped = 0;
  for (const product of products) {
    const [existing] = await db
      .select({ id: productsTable.id, translations: productsTable.translations })
      .from(productsTable)
      .where(eq(productsTable.slug, product.slug));
    if (existing) {
      const translations = productTranslations(product);
      if (isEmpty(existing.translations) && !isEmpty(translations))
        await writer.update(existing.id, { translations });
      if (!options.demoMerchandising)
        await removeDemoMerchandising(db, writer, existing.id, product);
      skipped += 1;
      continue;
    }
    const id = await writer.create(toCreateInput(product, options));
    await writer.setStatus(id, 'PUBLISHED');
    // Demo-only projections that normally come from review-service and the publish time.
    await db
      .update(productsTable)
      .set({
        ...(options.demoMerchandising
          ? { ratingAverage: product.rating.average, ratingCount: product.rating.count }
          : {}),
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
    .select({ id: configurators.id, translations: configurators.translations })
    .from(configurators)
    .where(eq(configurators.slug, CSE_CUSTOM.slug));
  if (existing) {
    if (isEmpty(existing.translations))
      await db
        .update(configurators)
        .set({ translations: { ro: romanianConfigurator } })
        .where(eq(configurators.id, existing.id));
    return;
  }
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
        translations: { ro: romanianConfigurator },
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

/**
 * Takes the demo merchandising off a product seeded with it earlier, touching only values that
 * still equal the demo data: ratings from real reviews, badges and prices an admin set stay.
 */
async function removeDemoMerchandising(
  db: Database,
  writer: CatalogWriterService,
  productId: string,
  demo: Product,
): Promise<void> {
  const [row] = await db
    .select({
      badges: productsTable.badges,
      ratingAverage: productsTable.ratingAverage,
      ratingCount: productsTable.ratingCount,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  if (!row) return;
  if (demo.badges.length > 0 && sameItems(row.badges, demo.badges))
    await writer.update(productId, { badges: [] });
  if (
    row.ratingCount === demo.rating.count &&
    Math.abs(row.ratingAverage - demo.rating.average) < 0.01
  )
    await db
      .update(productsTable)
      .set({ ratingAverage: 0, ratingCount: 0 })
      .where(eq(productsTable.id, productId));
  const variants = await db
    .select({
      id: productVariantsTable.id,
      sku: productVariantsTable.sku,
      compareAt: productVariantsTable.compareAtAmount,
    })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));
  for (const variant of variants) {
    const seeded = demo.variants.find((v) => v.sku === variant.sku)?.compareAtPrice?.amount;
    if (seeded !== undefined && variant.compareAt === seeded)
      await writer.updateVariant(productId, variant.id, { compareAtPrice: null });
  }
}

const sameItems = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));
