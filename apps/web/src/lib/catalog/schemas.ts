import { MoneySchema } from '@market/types';
import { z } from 'zod';

/**
 * Catalog read models as the storefront consumes them. These mirror the
 * product-service response DTOs (Phase 5); every API response is parsed with
 * them, so a contract drift fails loudly instead of rendering garbage.
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
