import { z } from 'zod';
import { MoneySchema } from './money.js';
import { MAX_PAGE_SIZE } from './pagination.js';

/**
 * Catalog API contract (product-service responses). The service builds its
 * responses with these types and the storefront parses every response with the
 * same schemas, so a contract drift fails loudly instead of rendering garbage.
 */

export const PRODUCT_KINDS = [
  'keyboard',
  'switch',
  'keycaps',
  'stabilizer',
  'cable',
  'deskmat',
  'wristrest',
] as const;
export const ProductKindSchema = z.enum(PRODUCT_KINDS);
export type ProductKind = z.infer<typeof ProductKindSchema>;

export const KEYBOARD_LAYOUTS = ['60%', '65%', '75%', 'TKL', '96%', '100%'] as const;
export const KeyboardLayoutSchema = z.enum(KEYBOARD_LAYOUTS);
export type KeyboardLayout = z.infer<typeof KeyboardLayoutSchema>;

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * Parameters for the procedurally rendered product preview. Used while product
 * photography is not available and by the configurator to preview combinations.
 */
export const ProductPreviewSchema = z.object({
  kind: ProductKindSchema,
  layout: KeyboardLayoutSchema.optional(),
  caseColor: HexColor,
  keyColor: HexColor,
  accentColor: HexColor,
  legendColor: HexColor,
});
export type ProductPreview = z.infer<typeof ProductPreviewSchema>;

export const ProductImageSchema = z.object({
  url: z.url(),
  alt: z.string(),
  width: z.int().positive(),
  height: z.int().positive(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const BadgeSchema = z.enum(['NEW', 'BESTSELLER', 'LIMITED', 'SALE']);
export type Badge = z.infer<typeof BadgeSchema>;

export const AvailabilitySchema = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER']);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const RatingSchema = z.object({
  average: z.number().min(0).max(5),
  count: z.int().nonnegative(),
});

export const CategorySchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  parentSlug: z.string().nullable(),
  preview: ProductPreviewSchema,
});
export type Category = z.infer<typeof CategorySchema>;

export const ProductSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  categorySlug: z.string().min(1),
  kind: ProductKindSchema,
  tagline: z.string(),
  /** Lowest variant price ("from" price). */
  price: MoneySchema,
  compareAtPrice: MoneySchema.nullable(),
  rating: RatingSchema,
  badges: z.array(BadgeSchema),
  availability: AvailabilitySchema,
  /** Filterable attributes; multi-valued, e.g. { layout: ["75%"], switchType: ["Linear", "Tactile"] }. */
  attributes: z.record(z.string(), z.array(z.string())),
  images: z.array(ProductImageSchema),
  preview: ProductPreviewSchema,
  createdAt: z.iso.datetime(),
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const OptionValueSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  /** Hex color for color swatches. */
  swatch: HexColor.optional(),
  hint: z.string().optional(),
});

export const ProductOptionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  display: z.enum(['swatch', 'pill']),
  values: z.array(OptionValueSchema).min(1),
});
export type ProductOption = z.infer<typeof ProductOptionSchema>;

export const VariantSchema = z.object({
  id: z.uuid(),
  sku: z.string().min(1),
  /** Selected value per option key, e.g. { color: "carbon", switch: "linear" }. */
  options: z.record(z.string(), z.string()),
  price: MoneySchema,
  compareAtPrice: MoneySchema.nullable(),
  availability: AvailabilitySchema,
  preview: ProductPreviewSchema,
  images: z.array(ProductImageSchema),
});
export type Variant = z.infer<typeof VariantSchema>;

export const SpecGroupSchema = z.object({
  group: z.string().min(1),
  items: z.array(z.object({ label: z.string(), value: z.string() })),
});

export const ProductSchema = ProductSummarySchema.extend({
  description: z.array(z.string()),
  highlights: z.array(z.string()),
  options: z.array(ProductOptionSchema),
  variants: z.array(VariantSchema).min(1),
  specs: z.array(SpecGroupSchema),
  included: z.array(z.string()),
  compatibility: z.array(z.string()),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});
export type Product = z.infer<typeof ProductSchema>;

export const ReviewSchema = z.object({
  id: z.uuid(),
  author: z.string(),
  rating: z.int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  productName: z.string(),
  verifiedPurchase: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

export const FacetSchema = z.object({
  key: z.string(),
  label: z.string(),
  values: z.array(z.object({ value: z.string(), count: z.int().nonnegative() })),
});
export type Facet = z.infer<typeof FacetSchema>;

export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductListingSchema = z.object({
  items: z.array(ProductSummarySchema),
  page: z.int().min(1),
  pageSize: z.int().min(1),
  total: z.int().nonnegative(),
  totalPages: z.int().min(1),
  facets: z.array(FacetSchema),
});
export type ProductListing = z.infer<typeof ProductListingSchema>;

/** Attribute keys exposed as listing filters, in display order. */
export const FILTER_KEYS = [
  { key: 'brand', label: 'Brand' },
  { key: 'layout', label: 'Layout' },
  { key: 'switchType', label: 'Switch type' },
  { key: 'connection', label: 'Connection' },
  { key: 'mount', label: 'Mounting' },
  { key: 'profile', label: 'Profile' },
  { key: 'material', label: 'Material' },
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number]['key'];

const sortValues = SORT_OPTIONS.map((option) => option.value) as [SortOption, ...SortOption[]];

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    (Array.isArray(value) ? value : value ? value.split(',') : [])
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

/**
 * Listing query, shared by the storefront URL and the product-service API.
 * Invalid values fall back to defaults instead of erroring: URLs are user-editable.
 */
export const CatalogQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional().catch(undefined),
  category: z.string().trim().max(80).optional().catch(undefined),
  sort: z.enum(sortValues).default('featured').catch('featured'),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(24).catch(24),
  inStock: z
    .enum(['1', 'true'])
    .optional()
    .transform((value) => value !== undefined)
    .catch(false),
  /** Price bounds in major currency units (e.g. euros), as typed by shoppers. */
  minPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  brand: list.catch([]),
  layout: list.catch([]),
  switchType: list.catch([]),
  connection: list.catch([]),
  mount: list.catch([]),
  profile: list.catch([]),
  material: list.catch([]),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

// ── Configurator ─────────────────────────────────────────────────────────────

export const CONFIGURATOR_GROUPS = [
  'layout',
  'case',
  'switch',
  'plate',
  'keycaps',
  'connection',
] as const;
export const ConfiguratorGroupSchema = z.enum(CONFIGURATOR_GROUPS);
export type ConfiguratorGroup = z.infer<typeof ConfiguratorGroupSchema>;

export const ConfiguratorSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  basePrice: MoneySchema,
  groups: z.array(
    z.object({
      key: ConfiguratorGroupSchema,
      label: z.string(),
      options: z.array(
        z.object({
          value: z.string(),
          label: z.string(),
          description: z.string().nullable(),
          priceDelta: MoneySchema,
          available: z.boolean(),
          swatch: HexColor.nullable(),
        }),
      ),
    }),
  ),
  /** Pairs that cannot be combined, e.g. Bluetooth with the full-size steel plate. */
  incompatibilities: z.array(
    z.object({
      a: z.object({ group: ConfiguratorGroupSchema, value: z.string() }),
      b: z.object({ group: ConfiguratorGroupSchema, value: z.string() }),
      reason: z.string(),
    }),
  ),
  defaultSelection: z.partialRecord(ConfiguratorGroupSchema, z.string()),
});
export type Configurator = z.infer<typeof ConfiguratorSchema>;

/** A (possibly incomplete) choice per group; the server reports what is missing. */
export const ConfigurationSelectionSchema = z.partialRecord(
  ConfiguratorGroupSchema,
  z.string().min(1).max(40),
);
export type ConfigurationSelection = z.infer<typeof ConfigurationSelectionSchema>;

export const ConfigurationQuoteSchema = z.object({
  /** Deterministic: the same selection always yields the same id. */
  configurationId: z.string().regex(/^cfg_[0-9a-f]{20}$/),
  sku: z.string(),
  selection: ConfigurationSelectionSchema,
  price: MoneySchema,
  /** Base price (group null) plus every surcharge; the amounts sum to `price`. */
  breakdown: z.array(
    z.object({ group: ConfiguratorGroupSchema.nullable(), label: z.string(), amount: MoneySchema }),
  ),
  preview: ProductPreviewSchema,
});
export type ConfigurationQuote = z.infer<typeof ConfigurationQuoteSchema>;
