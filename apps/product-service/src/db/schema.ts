import type { ProductPreview } from '@market/types';
import { sql, type SQL } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * product-service owns the `products` database: catalog, merchandising and
 * configurator rules. Prices live here (the source of truth for every service);
 * stock lives in inventory-service, availability here is a projection of it.
 */

export { inboxEvents, outboxEvents } from '@market/db';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const productKind = pgEnum('product_kind', [
  'keyboard',
  'switch',
  'keycaps',
  'stabilizer',
  'cable',
  'deskmat',
  'wristrest',
]);
export const productStatus = pgEnum('product_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const availability = pgEnum('availability', [
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'PREORDER',
]);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'restrict',
    }),
    preview: jsonb('preview').$type<ProductPreview>().notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('categories_slug_key').on(t.slug),
    index('categories_parent_idx').on(t.parentId),
  ],
);

export interface ProductOptionValue {
  value: string;
  label: string;
  swatch?: string;
  hint?: string;
}
export interface ProductOptionDefinition {
  key: string;
  name: string;
  display: 'swatch' | 'pill';
  values: ProductOptionValue[];
}
export interface SpecGroup {
  group: string;
  items: { label: string; value: string }[];
}

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    kind: productKind('kind').notNull(),
    status: productStatus('status').notNull().default('DRAFT'),
    tagline: text('tagline').notNull().default(''),
    description: text('description')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    highlights: text('highlights')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    included: text('included')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    compatibility: text('compatibility')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    badges: text('badges')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    faq: jsonb('faq').$type<{ question: string; answer: string }[]>().notNull().default([]),
    specs: jsonb('specs').$type<SpecGroup[]>().notNull().default([]),
    /** Option groups (color, switch...) whose values the variants combine. */
    options: jsonb('options').$type<ProductOptionDefinition[]>().notNull().default([]),
    preview: jsonb('preview').$type<ProductPreview>().notNull(),
    /** Merchandising order for the "featured" sort; null = not featured. */
    featuredRank: integer('featured_rank'),

    // Denormalised read fields, recomputed on every write to the product or its variants.
    minPriceAmount: integer('min_price_amount'),
    minPriceCompareAtAmount: integer('min_price_compare_at_amount'),
    currency: text('currency').notNull(),
    availability: availability('availability').notNull().default('OUT_OF_STOCK'),
    /** Projection of review-service ratings (updated from ReviewCreated events). */
    ratingAverage: real('rating_average').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),

    /** Name, brand, tagline, category, SKUs and attribute values: the searchable text. */
    searchDocument: text('search_document').notNull().default(''),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${products.searchDocument})`,
    ),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('products_slug_key').on(t.slug),
    index('products_category_idx').on(t.categoryId),
    index('products_status_idx').on(t.status),
    index('products_search_vector_idx').using('gin', t.searchVector),
    index('products_search_trgm_idx').using('gin', sql`${t.searchDocument} gin_trgm_ops`),
    check('products_rating_range', sql`${t.ratingAverage} BETWEEN 0 AND 5`),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    /** Selected value per option key, e.g. { color: "carbon", switch: "linear" }. */
    options: jsonb('options').$type<Record<string, string>>().notNull(),
    /** Minor units (cents). */
    priceAmount: integer('price_amount').notNull(),
    compareAtAmount: integer('compare_at_amount'),
    currency: text('currency').notNull(),
    availability: availability('availability').notNull().default('IN_STOCK'),
    preview: jsonb('preview').$type<ProductPreview>().notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('product_variants_sku_key').on(t.sku),
    index('product_variants_product_idx').on(t.productId),
    check('product_variants_price_positive', sql`${t.priceAmount} >= 0`),
    check(
      'product_variants_compare_at_above_price',
      sql`${t.compareAtAmount} IS NULL OR ${t.compareAtAmount} > ${t.priceAmount}`,
    ),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Optional: an image specific to one variant (e.g. a colorway). */
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    alt: text('alt').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.position)],
);

/** Filterable/searchable attributes; multi-valued (one row per value). */
export const productAttributes = pgTable(
  'product_attributes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
  },
  (t) => [
    uniqueIndex('product_attributes_unique').on(t.productId, t.key, t.value),
    index('product_attributes_key_value_idx').on(t.key, t.value),
  ],
);

// ── Configurator ─────────────────────────────────────────────────────────────

export const configuratorGroup = pgEnum('configurator_group', [
  'layout',
  'case',
  'switch',
  'plate',
  'keycaps',
  'connection',
]);

export const configurators = pgTable(
  'configurators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    skuPrefix: text('sku_prefix').notNull(),
    basePriceAmount: integer('base_price_amount').notNull(),
    currency: text('currency').notNull(),
    basePreview: jsonb('base_preview').$type<ProductPreview>().notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('configurators_slug_key').on(t.slug)],
);

export const configuratorOptions = pgTable(
  'configurator_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    configuratorId: uuid('configurator_id')
      .notNull()
      .references(() => configurators.id, { onDelete: 'cascade' }),
    group: configuratorGroup('group').notNull(),
    value: text('value').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    /** Surcharge over the base price (the base is the cheapest configuration). */
    priceDeltaAmount: integer('price_delta_amount').notNull().default(0),
    skuCode: text('sku_code').notNull(),
    swatch: text('swatch'),
    /** Partial preview applied when this option is selected (layout, case color...). */
    preview: jsonb('preview').$type<Partial<ProductPreview>>().notNull().default({}),
    available: boolean('available').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    uniqueIndex('configurator_options_unique').on(t.configuratorId, t.group, t.value),
    check('configurator_options_delta_non_negative', sql`${t.priceDeltaAmount} >= 0`),
  ],
);

export const configuratorIncompatibilities = pgTable(
  'configurator_incompatibilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    configuratorId: uuid('configurator_id')
      .notNull()
      .references(() => configurators.id, { onDelete: 'cascade' }),
    groupA: configuratorGroup('group_a').notNull(),
    valueA: text('value_a').notNull(),
    groupB: configuratorGroup('group_b').notNull(),
    valueB: text('value_b').notNull(),
    reason: text('reason').notNull(),
  },
  (t) => [index('configurator_incompatibilities_idx').on(t.configuratorId)],
);

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type VariantRow = typeof productVariants.$inferSelect;
export type ImageRow = typeof productImages.$inferSelect;
