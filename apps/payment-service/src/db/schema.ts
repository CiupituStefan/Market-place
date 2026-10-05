import { inboxEvents, outboxEvents } from '@market/db';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * payment-service owns the `payments` database. No card data is ever stored:
 * only Stripe identifiers, amounts and statuses (PCI scope stays with Stripe).
 */

export { inboxEvents, outboxEvents };

export const paymentStatus = pgEnum('payment_status', [
  'REQUIRES_PAYMENT',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
]);

/** One row per Stripe PaymentIntent. */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    provider: text('provider').notNull(),
    /** Null only in the instant between inserting the row and creating the intent. */
    providerPaymentId: text('provider_payment_id'),
    status: paymentStatus('status').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    refundedAmount: integer('refunded_amount').notNull().default(0),
    lastError: text('last_error'),
    succeededAt: timestamp('succeeded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payments_provider_payment_key').on(t.providerPaymentId),
    index('payments_order_idx').on(t.orderId),
    // At most one open intent per order: concurrent "pay" clicks reuse it.
    uniqueIndex('payments_one_open_per_order')
      .on(t.orderId)
      .where(sql`${t.status} IN ('REQUIRES_PAYMENT', 'PROCESSING')`),
    check('payments_amount_positive', sql`${t.amount} > 0`),
    check(
      'payments_refund_within_amount',
      sql`${t.refundedAmount} >= 0 AND ${t.refundedAmount} <= ${t.amount}`,
    ),
  ],
);

export const refundStatus = pgEnum('refund_status', ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    providerRefundId: text('provider_refund_id'),
    amount: integer('amount').notNull(),
    status: refundStatus('status').notNull(),
    reason: text('reason').notNull(),
    /** User id, or `system` for automatic refunds of orders that cannot be fulfilled. */
    requestedBy: text('requested_by').notNull(),
    /** Set once order-service has been told about this settled refund. */
    orderNotifiedAt: timestamp('order_notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refunds_provider_refund_key').on(t.providerRefundId),
    index('refunds_payment_idx').on(t.paymentId),
    check('refunds_amount_positive', sql`${t.amount} > 0`),
  ],
);

/**
 * Webhook inbox: one row per Stripe event that was fully processed. Stripe
 * delivers at least once; a duplicate delivery is acknowledged without effect.
 */
export const webhookEvents = pgTable('webhook_events', {
  eventId: text('event_id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentRow = typeof payments.$inferSelect;
export type RefundRow = typeof refunds.$inferSelect;
