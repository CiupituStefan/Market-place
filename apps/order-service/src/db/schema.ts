import { outboxEvents } from '@market/db';
import {
  ORDER_STATUSES,
  type Address,
  type CancelReason,
  type ConfigurationSelection,
  type ProductPreview,
} from '@market/types';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * order-service owns the `orders` database. An order is a snapshot: prices, names
 * and addresses are copied at checkout and never re-read from other services.
 */

export { outboxEvents };

export const orderStatus = pgEnum('order_status', ORDER_STATUSES);
export const orderItemKind = pgEnum('order_item_kind', ['variant', 'configuration']);

/** Human-friendly order numbers: CSE-100001, CSE-100002, ... */
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 100_001 });

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    number: text('number')
      .notNull()
      .default(sql`'CSE-' || nextval('order_number_seq')`),
    status: orderStatus('status').notNull(),
    userId: uuid('user_id'),
    email: text('email').notNull(),
    /** SHA-256 of the guest's order access token (null for signed-in orders). */
    accessTokenHash: text('access_token_hash'),
    /** SHA-256 of the visitor cart token that placed a guest order: the same browser can view it. */
    guestCartHash: text('guest_cart_hash'),
    /** cart-service cart this order came from (emptied once paid). */
    cartId: uuid('cart_id'),
    currency: text('currency').notNull(),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull(),
    shipping: integer('shipping').notNull(),
    tax: integer('tax').notNull(),
    vatRateBps: integer('vat_rate_bps').notNull(),
    total: integer('total').notNull(),
    couponCode: text('coupon_code'),
    shippingAddress: jsonb('shipping_address').$type<Address>().notNull(),
    billingAddress: jsonb('billing_address').$type<Address>().notNull(),
    notes: text('notes'),
    reservationId: uuid('reservation_id'),
    paymentId: uuid('payment_id'),
    paymentDueAt: timestamp('payment_due_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason').$type<CancelReason>(),
    /** A payment arrived that we could not fulfil; payment-service must refund it. */
    refundRequired: boolean('refund_required').notNull().default(false),
    failureReason: text('failure_reason'),
    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_number_key').on(t.number),
    index('orders_user_created_idx').on(t.userId, t.createdAt),
    index('orders_status_due_idx').on(t.status, t.paymentDueAt),
    index('orders_created_idx').on(t.createdAt),
    check(
      'orders_amounts_valid',
      sql`${t.subtotal} >= 0 AND ${t.discount} >= 0 AND ${t.shipping} >= 0 AND ${t.tax} >= 0 AND ${t.total} = ${t.subtotal} - ${t.discount} + ${t.shipping}`,
    ),
    check('orders_has_owner', sql`${t.userId} IS NOT NULL OR ${t.accessTokenHash} IS NOT NULL`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: orderItemKind('kind').notNull(),
    variantId: uuid('variant_id'),
    configurator: text('configurator'),
    configurationId: text('configuration_id'),
    selection: jsonb('selection').$type<ConfigurationSelection>(),
    productSlug: text('product_slug'),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    optionsLabel: text('options_label').notNull(),
    preview: jsonb('preview').$type<ProductPreview>().notNull(),
    imageUrl: text('image_url'),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    lineTotal: integer('line_total').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId, t.position),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
    check('order_items_line_total', sql`${t.lineTotal} = ${t.unitPrice} * ${t.quantity}`),
  ],
);

/** Append-only audit of every status change and who made it. */
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    /** Identity, not a timestamp: entries written in one transaction share now(). */
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    note: text('note'),
    /** User id, or `system` / `customer` / `payment-service`. */
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId, t.id)],
);

/**
 * `Idempotency-Key` claims for "place order". `order_id` is null while the first
 * request is still running; a failed checkout deletes its claim so it can be retried.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    orderId: uuid('order_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.key] }),
    index('idempotency_keys_created_idx').on(t.createdAt),
  ],
);

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type HistoryRow = typeof orderStatusHistory.$inferSelect;
