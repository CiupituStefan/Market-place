import { inboxEvents, outboxEvents } from '@market/db';
import { REVIEW_STATUSES } from '@market/types';
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** review-service owns the `reviews` database. */

export { inboxEvents, outboxEvents };

export const reviewStatus = pgEnum('review_status', REVIEW_STATUSES);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull(),
    userId: uuid('user_id').notNull(),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: reviewStatus('status').notNull(),
    /** Why a review is pending or rejected (automatic check or moderator). */
    moderationNote: text('moderation_note'),
    verifiedPurchase: boolean('verified_purchase').notNull().default(false),
    helpfulCount: integer('helpful_count').notNull().default(0),
    notHelpfulCount: integer('not_helpful_count').notNull().default(0),
    reportCount: integer('report_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One review per shopper per product (edit it instead).
    uniqueIndex('reviews_product_user_key').on(t.productId, t.userId),
    index('reviews_product_status_created_idx').on(t.productId, t.status, t.createdAt),
    index('reviews_status_created_idx').on(t.status, t.createdAt),
    check('reviews_rating_range', sql`${t.rating} BETWEEN 1 AND 5`),
    check(
      'reviews_counts_nonnegative',
      sql`${t.helpfulCount} >= 0 AND ${t.notHelpfulCount} >= 0 AND ${t.reportCount} >= 0`,
    ),
  ],
);

/** One vote per shopper per review; changing your mind updates it. */
export const reviewVotes = pgTable(
  'review_votes',
  {
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    helpful: boolean('helpful').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.userId] })],
);

/** One report per shopper per review. */
export const reviewReports = pgTable(
  'review_reports',
  {
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.userId] })],
);

/**
 * Projection of order events: which signed-in shoppers bought which products.
 * Built from OrderCreated (lines), confirmed by OrderPaid, removed by OrderCancelled.
 */
export const purchases = pgTable(
  'purchases',
  {
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id').notNull(),
    userId: uuid('user_id').notNull(),
    paid: boolean('paid').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.productId] }),
    index('purchases_user_product_idx').on(t.userId, t.productId),
  ],
);

export type ReviewRow = typeof reviews.$inferSelect;
