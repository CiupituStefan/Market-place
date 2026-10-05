import { z } from 'zod';

export const REVIEW_STATUSES = ['PUBLISHED', 'PENDING', 'REJECTED'] as const;
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const REVIEW_SORTS = ['newest', 'helpful', 'highest', 'lowest'] as const;
export const ReviewSortSchema = z.enum(REVIEW_SORTS);
export type ReviewSort = z.infer<typeof ReviewSortSchema>;

/** A review as shoppers see it. */
export const ProductReviewSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  authorName: z.string(),
  rating: z.int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  verifiedPurchase: z.boolean(),
  helpfulCount: z.int().nonnegative(),
  notHelpfulCount: z.int().nonnegative(),
  /** The viewer's own vote, when signed in. */
  myVote: z.enum(['helpful', 'not_helpful']).nullable(),
  mine: z.boolean(),
  status: ReviewStatusSchema,
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
});
export type ProductReview = z.infer<typeof ProductReviewSchema>;

export const RatingSummarySchema = z.object({
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
  verifiedCount: z.int().nonnegative(),
});
export type RatingSummary = z.infer<typeof RatingSummarySchema>;

export const ReviewPageSchema = z.object({
  summary: RatingSummarySchema,
  items: z.array(ProductReviewSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
  totalPages: z.int(),
});
export type ReviewPage = z.infer<typeof ReviewPageSchema>;

const text = (min: number, max: number, what: string) =>
  z
    .string()
    .trim()
    .min(min, `${what} needs at least ${String(min)} characters`)
    .max(max, `${what} can be at most ${String(max)} characters`);

/** Writing or editing a review (the product comes from the URL / request, the author from the session). */
export const ReviewInputSchema = z
  .object({
    rating: z.int().min(1, 'Choose a rating').max(5),
    title: text(3, 120, 'The title'),
    body: text(20, 4_000, 'The review'),
    authorName: text(2, 40, 'Your name'),
  })
  .strict();
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const CreateReviewSchema = ReviewInputSchema.extend({ productId: z.uuid() }).strict();
export type CreateReview = z.infer<typeof CreateReviewSchema>;
