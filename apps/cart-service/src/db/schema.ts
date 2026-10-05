import type { ConfigurationSelection } from '@market/types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * cart-service owns the `cart` database: carts, discount codes and wishlists.
 * Prices are never trusted from here: `unit_price_snapshot` only remembers what
 * the shopper last saw, so a later price change can be pointed out.
 */

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Signed-in owner; a user has at most one cart. */
    userId: uuid('user_id'),
    /** SHA-256 of the visitor's cart cookie token. */
    guestTokenHash: text('guest_token_hash'),
    couponCode: text('coupon_code'),
    currency: text('currency').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('carts_user_key').on(t.userId),
    uniqueIndex('carts_guest_token_key').on(t.guestTokenHash),
    check('carts_has_owner', sql`${t.userId} IS NOT NULL OR ${t.guestTokenHash} IS NOT NULL`),
    index('carts_updated_idx').on(t.updatedAt),
  ],
);

export const cartItemKind = pgEnum('cart_item_kind', ['variant', 'configuration']);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    kind: cartItemKind('kind').notNull(),
    variantId: uuid('variant_id'),
    configurator: text('configurator'),
    configurationId: text('configuration_id'),
    selection: jsonb('selection').$type<ConfigurationSelection>(),
    quantity: integer('quantity').notNull(),
    unitPriceSnapshot: integer('unit_price_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cart_items_variant_key').on(t.cartId, t.variantId),
    uniqueIndex('cart_items_configuration_key').on(t.cartId, t.configurationId),
    check('cart_items_quantity_range', sql`${t.quantity} BETWEEN 1 AND 10`),
    check(
      'cart_items_kind_fields',
      sql`(${t.kind} = 'variant' AND ${t.variantId} IS NOT NULL) OR (${t.kind} = 'configuration' AND ${t.configurationId} IS NOT NULL AND ${t.selection} IS NOT NULL)`,
    ),
  ],
);

export const discountType = pgEnum('discount_type', ['PERCENTAGE', 'FIXED']);

export const discountCodes = pgTable(
  'discount_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored upper-case; customers may type any case. */
    code: text('code').notNull(),
    type: discountType('type').notNull(),
    /** Basis points for PERCENTAGE, minor units for FIXED. */
    value: integer('value').notNull(),
    currency: text('currency').notNull(),
    minSubtotal: integer('min_subtotal'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usageLimit: integer('usage_limit'),
    perCustomerLimit: integer('per_customer_limit'),
    usedCount: integer('used_count').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('discount_codes_code_key').on(t.code),
    check('discount_codes_value_positive', sql`${t.value} > 0`),
    check('discount_codes_percentage_max', sql`${t.type} <> 'PERCENTAGE' OR ${t.value} <= 10000`),
    check(
      'discount_codes_usage_within_limit',
      sql`${t.usageLimit} IS NULL OR ${t.usedCount} <= ${t.usageLimit}`,
    ),
  ],
);

/** One row per order that used a code; held from order creation, released if the order is cancelled. */
export const discountRedemptions = pgTable(
  'discount_redemptions',
  {
    orderId: uuid('order_id').primaryKey(),
    discountCodeId: uuid('discount_code_id')
      .notNull()
      .references(() => discountCodes.id, { onDelete: 'restrict' }),
    userId: uuid('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('discount_redemptions_code_user_idx').on(t.discountCodeId, t.userId)],
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    userId: uuid('user_id').notNull(),
    variantId: uuid('variant_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.variantId] })],
);

export type CartRow = typeof carts.$inferSelect;
export type CartItemRow = typeof cartItems.$inferSelect;
export type DiscountCodeRow = typeof discountCodes.$inferSelect;
