'use client';

import { MoneySchema } from '@market/types';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ProductPreviewSchema } from '@/lib/catalog/schemas';
import { api } from './browser';

/** Cart as returned by cart-service: every amount is computed server-side. */
export const CartSchema = z.object({
  id: z.uuid(),
  items: z.array(
    z.object({
      id: z.uuid(),
      variantId: z.uuid(),
      sku: z.string(),
      productSlug: z.string(),
      name: z.string(),
      optionsLabel: z.string(),
      quantity: z.int().positive(),
      unitPrice: MoneySchema,
      lineTotal: MoneySchema,
      preview: ProductPreviewSchema,
      available: z.boolean(),
    }),
  ),
  couponCode: z.string().nullable(),
  subtotal: MoneySchema,
  discount: MoneySchema,
  shipping: MoneySchema.nullable(),
  tax: MoneySchema,
  total: MoneySchema,
});
export type Cart = z.infer<typeof CartSchema>;

export function useCart() {
  return useQuery({ queryKey: ['cart'], queryFn: () => api('/cart', { schema: CartSchema }) });
}
