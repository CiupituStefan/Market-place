import { inboxEvents } from '@market/db';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** notification-service owns the `notifications` database. */

export { inboxEvents };

export const NOTIFICATION_STATUSES = ['QUEUED', 'SENT', 'FAILED', 'SUPPRESSED'] as const;
export const notificationStatus = pgEnum('notification_status', NOTIFICATION_STATUSES);

/**
 * One row per email we decided to send (or deliberately did not: SUPPRESSED).
 * `notification_key` makes every request idempotent: a redelivered event or a
 * double-submitted form never produces a second email.
 */
export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationKey: text('notification_key').notNull(),
    channel: text('channel').notNull().default('EMAIL'),
    template: text('template').notNull(),
    userId: uuid('user_id'),
    recipient: text('recipient').notNull(),
    /** Template variables, rendered at send time. Erased once no longer needed. */
    data: jsonb('data').$type<Record<string, unknown>>(),
    status: notificationStatus('status').notNull().default('QUEUED'),
    subject: text('subject'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    providerMessageId: text('provider_message_id'),
    /** Why a notification was not sent (preference, unsubscribed). */
    suppressedReason: text('suppressed_reason'),
    /** Event or request that caused it, for tracing. */
    correlationId: text('correlation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('notification_logs_key').on(t.notificationKey),
    // The dispatcher's queue scan.
    index('notification_logs_due_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'QUEUED'`),
    index('notification_logs_recipient_idx').on(t.recipient, t.createdAt),
    index('notification_logs_status_created_idx').on(t.status, t.createdAt),
  ],
);

/**
 * Per-account choices. Security and order-confirmation emails are always sent;
 * only optional categories have a switch. No row means the defaults.
 */
export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id').primaryKey(),
  /** Shipping and delivery updates. */
  orderUpdates: boolean('order_updates').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const NEWSLETTER_STATUSES = ['PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED'] as const;
export const newsletterStatus = pgEnum('newsletter_status', NEWSLETTER_STATUSES);

/** Double opt-in newsletter list, keyed by (lower-cased) email. */
export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    email: text('email').primaryKey(),
    status: newsletterStatus('status').notNull(),
    confirmTokenHash: text('confirm_token_hash'),
    confirmExpiresAt: timestamp('confirm_expires_at', { withTimezone: true }),
    /** Last confirmation email: limits resends to one per cooldown. */
    confirmSentAt: timestamp('confirm_sent_at', { withTimezone: true }),
    source: text('source').notNull(),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('newsletter_confirm_token_key').on(t.confirmTokenHash),
    check('newsletter_email_lower', sql`${t.email} = lower(${t.email})`),
  ],
);

/**
 * Projection of OrderCreated: what an order email needs (address, lines, totals),
 * so later events that only carry an order id can still be rendered without
 * calling order-service.
 */
export const orderContacts = pgTable('order_contacts', {
  orderId: uuid('order_id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  userId: uuid('user_id'),
  email: text('email').notNull(),
  summary: jsonb('summary').$type<OrderSummary>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface Money {
  amount: number;
  currency: string;
}

export interface OrderSummary {
  lines: { name: string; sku: string; quantity: number; unitPrice: Money }[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  tax: Money;
  total: Money;
  couponCode: string | null;
}

export type NotificationLogRow = typeof notificationLogs.$inferSelect;
export type OrderContactRow = typeof orderContacts.$inferSelect;
