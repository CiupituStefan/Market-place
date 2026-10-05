import { z } from 'zod';
import { api } from './browser';

/**
 * Commerce commands sent from the browser. Note what is NOT sent: prices or
 * totals. The cart service looks up the current price for the variant itself.
 */
export const AddToCartSchema = z.object({
  variantId: z.uuid(),
  quantity: z.int().min(1).max(10),
});
export type AddToCartInput = z.infer<typeof AddToCartSchema>;

export function addToCart(input: AddToCartInput): Promise<unknown> {
  return api('/cart/items', {
    method: 'POST',
    body: AddToCartSchema.parse(input),
    schema: z.unknown(),
  });
}

export function addToWishlist(variantId: string): Promise<unknown> {
  return api('/wishlist/items', { method: 'POST', body: { variantId }, schema: z.unknown() });
}
