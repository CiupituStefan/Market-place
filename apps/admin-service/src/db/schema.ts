import { inboxEvents } from '@market/db';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * admin-service owns the `admin` database: a read model for reporting, built
 * only from events (it never reads another service's database). Amounts are
 * integers in minor units.
 */

export { inboxEvents };

export const SALES_STATUSES = ['PENDING_PAYMENT', 'PAID', 'CANCELLED'] as const;
export const salesStatus = pgEnum('sales_status', SALES_STATUSES);

/** One row per order (OrderCreated), updated by OrderPaid and OrderCancelled. */
export const salesOrders = pgTable(
  'sales_orders',
  {
    orderId: uuid('order_id').primaryKey(),
    orderNumber: text('order_number').notNull(),
    userId: uuid('user_id'),
    email: text('email').notNull(),
    currency: text('currency').notNull(),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull(),
    shipping: integer('shipping').notNull(),
    tax: integer('tax').notNull(),
    total: integer('total').notNull(),
    couponCode: text('coupon_code'),
    shippingCountry: text('shipping_country').notNull(),
    status: salesStatus('status').notNull().default('PENDING_PAYMENT'),
    /** Kept when a paid order is cancelled later: the sale happened, the refund offsets it. */
    wasPaid: boolean('was_paid').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('sales_orders_paid_at_idx').on(t.paidAt),
    index('sales_orders_created_at_idx').on(t.createdAt),
    index('sales_orders_user_idx').on(t.userId),
  ],
);

export const salesLines = pgTable(
  'sales_lines',
  {
    orderId: uuid('order_id')
      .notNull()
      .references(() => salesOrders.orderId, { onDelete: 'cascade' }),
    lineNo: integer('line_no').notNull(),
    kind: text('kind').notNull(),
    variantId: uuid('variant_id'),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.lineNo] }),
    index('sales_lines_sku_idx').on(t.sku),
    check('sales_lines_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

/** Refunds settled at Stripe (PaymentRefunded), counted on the day they happen. */
export const salesRefunds = pgTable(
  'sales_refunds',
  {
    refundId: uuid('refund_id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    refundedAt: timestamp('refunded_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sales_refunds_refunded_at_idx').on(t.refundedAt)],
);
