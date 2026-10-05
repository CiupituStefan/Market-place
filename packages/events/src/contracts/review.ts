import { z } from 'zod';
import { defineEvent } from '../define.js';
import { Topics } from '../topics.js';

export const ReviewCreatedV1 = defineEvent({
  type: 'ReviewCreated',
  version: 1,
  topic: Topics.REVIEW,
  payload: z.object({
    reviewId: z.uuid(),
    productId: z.uuid(),
    userId: z.uuid(),
    rating: z.int().min(1).max(5),
    verifiedPurchase: z.boolean(),
  }),
});

/**
 * The full rating aggregate of a product after any change to its published
 * reviews (created, edited, deleted, moderated). Carrying the aggregate, not a
 * delta, makes consumers idempotent: applying it twice is harmless.
 */
export const ProductRatingChangedV1 = defineEvent({
  type: 'ProductRatingChanged',
  version: 1,
  topic: Topics.REVIEW,
  payload: z.object({
    productId: z.uuid(),
    average: z.number().min(0).max(5),
    count: z.int().nonnegative(),
    distribution: z.object({
      1: z.int().nonnegative(),
      2: z.int().nonnegative(),
      3: z.int().nonnegative(),
      4: z.int().nonnegative(),
      5: z.int().nonnegative(),
    }),
  }),
});
