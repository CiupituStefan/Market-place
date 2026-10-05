import { z } from 'zod';
import { ConfigurationSelectionSchema, ProductPreviewSchema } from './catalog.js';
import { MoneySchema } from './money.js';

/** Visitor cart cookie (httpOnly random token; only its hash is stored). */
export const CART_TOKEN_COOKIE = 'cse_cart';

export const MAX_CART_LINES = 50;
export const MAX_LINE_QUANTITY = 10;

export const CartNoticeSchema = z.object({
  code: z.enum(['PRICE_CHANGED', 'ITEM_UNAVAILABLE', 'INSUFFICIENT_STOCK', 'COUPON_REMOVED']),
  message: z.string(),
  itemId: z.uuid().nullable(),
});
export type CartNotice = z.infer<typeof CartNoticeSchema>;

export const CartItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['variant', 'configuration']),
  variantId: z.uuid().nullable(),
  configurationId: z.string().nullable(),
  configurator: z.string().nullable(),
  selection: ConfigurationSelectionSchema.nullable(),
  sku: z.string(),
  productSlug: z.string().nullable(),
  name: z.string(),
  optionsLabel: z.string(),
  quantity: z.int().min(1).max(MAX_LINE_QUANTITY),
  unitPrice: MoneySchema,
  lineTotal: MoneySchema,
  preview: ProductPreviewSchema,
  imageUrl: z.string().nullable(),
  /** False when the product is gone or there is not enough stock for this quantity. */
  available: z.boolean(),
  /** Sellable units right now; null when stock could not be checked. */
  availableQuantity: z.int().nonnegative().nullable(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

/**
 * The cart as computed by cart-service. Every amount is recomputed on the server
 * from current catalog prices; the browser only displays these numbers.
 */
export const CartSchema = z.object({
  /** Null for a visitor who has not added anything yet. */
  id: z.uuid().nullable(),
  items: z.array(CartItemSchema),
  itemCount: z.int().nonnegative(),
  couponCode: z.string().nullable(),
  notices: z.array(CartNoticeSchema),
  subtotal: MoneySchema,
  discount: MoneySchema,
  shipping: MoneySchema,
  /** VAT included in the total (prices are VAT-inclusive). */
  tax: MoneySchema,
  total: MoneySchema,
  freeShippingThreshold: MoneySchema,
  /** False when an item is unavailable; checkout must be blocked. */
  canCheckout: z.boolean(),
});
export type Cart = z.infer<typeof CartSchema>;

export const DiscountTypeSchema = z.enum(['PERCENTAGE', 'FIXED']);
export type DiscountType = z.infer<typeof DiscountTypeSchema>;

export const DiscountCodeSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  type: DiscountTypeSchema,
  /** Basis points for PERCENTAGE (1000 = 10%), minor units for FIXED. */
  value: z.int().positive(),
  minSubtotal: MoneySchema.nullable(),
  startsAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  usageLimit: z.int().positive().nullable(),
  perCustomerLimit: z.int().positive().nullable(),
  usedCount: z.int().nonnegative(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type DiscountCode = z.infer<typeof DiscountCodeSchema>;

export const WishlistItemSchema = z.object({
  variantId: z.uuid(),
  productSlug: z.string(),
  name: z.string(),
  optionsLabel: z.string(),
  price: MoneySchema,
  compareAtPrice: MoneySchema.nullable(),
  preview: ProductPreviewSchema,
  imageUrl: z.string().nullable(),
  available: z.boolean(),
  addedAt: z.iso.datetime(),
});
export type WishlistItem = z.infer<typeof WishlistItemSchema>;
