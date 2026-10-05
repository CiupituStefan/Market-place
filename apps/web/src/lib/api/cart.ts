'use client';

import {
  CartSchema,
  WishlistItemSchema,
  type Cart,
  type ConfigurationSelection,
} from '@market/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';
import { ApiError } from './errors';

export { CartSchema, type Cart };

export const CART_QUERY_KEY = ['cart'] as const;
export const WISHLIST_QUERY_KEY = ['wishlist'] as const;

/**
 * Cart as computed by cart-service. The browser sends intents (variant, quantity,
 * code) and renders what comes back; it never computes a price or a total.
 */
export function useCart() {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: () => api('/cart', { schema: CartSchema }),
    // Prices and stock move; a cart is cheap to re-read.
    staleTime: 10_000,
  });
}

/** Every cart command answers with the full re-priced cart: write it straight to the cache. */
function useCartCommand<TInput>(command: (input: TInput) => Promise<Cart>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: command,
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export const cartCommands = {
  addItem: (input: { variantId: string; quantity: number }) =>
    api('/cart/items', { method: 'POST', body: input, schema: CartSchema }),
  addConfiguration: (input: { configurator: string; selection: ConfigurationSelection }) =>
    api('/cart/configurations', {
      method: 'POST',
      body: { ...input, quantity: 1 },
      schema: CartSchema,
    }),
  updateQuantity: (input: { itemId: string; quantity: number }) =>
    api(`/cart/items/${input.itemId}`, {
      method: 'PATCH',
      body: { quantity: input.quantity },
      schema: CartSchema,
    }),
  removeItem: (itemId: string) =>
    api(`/cart/items/${itemId}`, { method: 'DELETE', schema: CartSchema }),
  applyCoupon: (code: string) =>
    api('/cart/coupon', { method: 'POST', body: { code }, schema: CartSchema }),
  removeCoupon: () => api('/cart/coupon', { method: 'DELETE', schema: CartSchema }),
};

export const useAddToCart = () => useCartCommand(cartCommands.addItem);
export const useAddConfigurationToCart = () => useCartCommand(cartCommands.addConfiguration);
export const useUpdateCartQuantity = () => useCartCommand(cartCommands.updateQuantity);
export const useRemoveCartItem = () => useCartCommand(cartCommands.removeItem);
export const useApplyCoupon = () => useCartCommand(cartCommands.applyCoupon);
export const useRemoveCoupon = () => useCartCommand(() => cartCommands.removeCoupon());

// ── wishlist (signed-in users) ───────────────────────────────────────────────

const WishlistSchema = z.array(WishlistItemSchema);

export function useWishlist(enabled = true) {
  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => api('/wishlist', { schema: WishlistSchema }),
    enabled,
  });
}

function useWishlistCommand<TInput>(command: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => WishlistSchema.parse(await command(input)),
    onSuccess: (items) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, items);
    },
  });
}

export const useAddToWishlist = () =>
  useWishlistCommand((variantId: string) =>
    api('/wishlist/items', { method: 'POST', body: { variantId }, schema: WishlistSchema }),
  );

export const useRemoveFromWishlist = () =>
  useWishlistCommand((variantId: string) =>
    api(`/wishlist/items/${variantId}`, { method: 'DELETE', schema: WishlistSchema }),
  );

/** True when the error means "sign in first" rather than a real failure. */
export function needsSignIn(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
