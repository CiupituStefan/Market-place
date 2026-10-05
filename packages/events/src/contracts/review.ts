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
