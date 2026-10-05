import {
  AvailabilitySchema,
  BadgeSchema,
  ProductKindSchema,
  ProductPreviewSchema,
  ProductStatusSchema,
} from '@market/types';
import { z } from 'zod';

/** Slugs appear in URLs; `manage` is reserved for the back-office routes. */
export const SlugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens')
  .refine((slug) => slug !== 'manage', 'This slug is reserved');

const Text = (max: number) => z.string().trim().min(1).max(max);
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const OptionDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,30}$/),
  name: Text(40),
  display: z.enum(['swatch', 'pill']),
  values: z
    .array(
      z.object({
        value: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
        label: Text(60),
        swatch: HexColor.optional(),
        hint: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .max(30),
});
export type OptionDefinition = z.infer<typeof OptionDefinitionSchema>;

/** Prices are integers in minor units; the currency is the catalog currency. */
const Amount = z.int().min(0).max(100_000_00);

export const VariantInputSchema = z
  .object({
    sku: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,63}$/, 'SKUs use uppercase letters, digits and hyphens'),
    options: z.record(z.string(), z.string()),
    price: Amount,
    compareAtPrice: Amount.nullable().default(null),
    availability: AvailabilitySchema.default('IN_STOCK'),
    preview: ProductPreviewSchema.optional(),
  })
  .strict()
  .refine((v) => v.compareAtPrice === null || v.compareAtPrice > v.price, {
    path: ['compareAtPrice'],
    message: 'Compare-at price must be higher than the price',
  });
export type VariantInput = z.infer<typeof VariantInputSchema>;

export const VariantUpdateSchema = z
  .object({
    price: Amount,
    compareAtPrice: Amount.nullable(),
    availability: AvailabilitySchema,
    preview: ProductPreviewSchema,
  })
  .partial()
  .strict();
export type VariantUpdate = z.infer<typeof VariantUpdateSchema>;

/** Product-level fields without defaults: PATCH must never reset what it was not given. */
const productFields = {
  name: Text(120),
  brand: Text(60),
  categorySlug: SlugSchema,
  kind: ProductKindSchema,
  tagline: z.string().trim().max(160),
  description: z.array(Text(4_000)).max(20),
  highlights: z.array(Text(200)).max(12),
  included: z.array(Text(200)).max(20),
  compatibility: z.array(Text(200)).max(20),
  faq: z.array(z.object({ question: Text(300), answer: Text(2_000) })).max(30),
  specs: z
    .array(
      z.object({
        group: Text(60),
        items: z.array(z.object({ label: Text(60), value: Text(200) })).max(40),
      }),
    )
    .max(12),
  badges: z.array(BadgeSchema).max(4),
  preview: ProductPreviewSchema,
  options: z.array(OptionDefinitionSchema).max(5),
  /** Filterable attributes, e.g. { layout: ["75%"], switchType: ["Linear", "Tactile"] }. */
  attributes: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,30}$/), z.array(Text(60)).max(20)),
  featuredRank: z.int().min(0).max(10_000).nullable(),
};

export const CreateProductSchema = z
  .object({
    ...productFields,
    slug: SlugSchema,
    tagline: productFields.tagline.default(''),
    description: productFields.description.default([]),
    highlights: productFields.highlights.default([]),
    included: productFields.included.default([]),
    compatibility: productFields.compatibility.default([]),
    faq: productFields.faq.default([]),
    specs: productFields.specs.default([]),
    badges: productFields.badges.default([]),
    options: productFields.options.default([]),
    attributes: productFields.attributes.default({}),
    featuredRank: productFields.featuredRank.default(null),
    variants: z.array(VariantInputSchema).min(1).max(200),
  })
  .strict();
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/** Partial update of product-level fields; variants have their own endpoints. */
export const UpdateProductSchema = z
  .object({ ...productFields, slug: SlugSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const CategoryInputSchema = z
  .object({
    slug: SlugSchema,
    name: Text(80),
    description: z.string().trim().max(500).default(''),
    parentSlug: SlugSchema.nullable().default(null),
    preview: ProductPreviewSchema,
    position: z.int().min(0).max(1_000).default(0),
  })
  .strict();
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

export const CategoryUpdateSchema = CategoryInputSchema.partial().strict();

export const ManageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: ProductStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
