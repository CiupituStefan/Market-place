import { MoneySchema } from '@market/types';
import { z } from 'zod';
import { defineEvent } from '../define.js';
import { Topics } from '../topics.js';

const VariantSnapshot = z.object({
  variantId: z.uuid(),
  sku: z.string().min(1),
  price: MoneySchema,
  attributes: z.record(z.string(), z.string()),
});

export const ProductCreatedV1 = defineEvent({
  type: 'ProductCreated',
  version: 1,
  topic: Topics.PRODUCT,
  payload: z.object({
    productId: z.uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().min(1),
    categoryId: z.uuid(),
    status: z.enum(['DRAFT', 'PUBLISHED']),
    variants: z.array(VariantSnapshot),
  }),
});

export const ProductUpdatedV1 = defineEvent({
  type: 'ProductUpdated',
  version: 1,
  topic: Topics.PRODUCT,
  payload: z.object({
    productId: z.uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    variants: z.array(VariantSnapshot),
    /** Top-level fields that changed, so consumers can skip irrelevant updates. */
    changedFields: z.array(z.string()),
  }),
});
