'use client';

import {
  ProductReviewSchema,
  ReviewPageSchema,
  type ReviewInput,
  type ReviewSort,
} from '@market/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';

export interface ReviewFilters {
  sort: ReviewSort;
  rating: number | null;
  verified: boolean;
  page: number;
}

const key = (productId: string) => ['reviews', productId] as const;

export function useReviews(productId: string, filters: ReviewFilters) {
  return useQuery({
    queryKey: [...key(productId), filters],
    queryFn: () =>
      api('/reviews', {
        schema: ReviewPageSchema,
        query: {
          productId,
          sort: filters.sort,
          rating: filters.rating,
          verified: filters.verified ? 1 : undefined,
          page: filters.page,
          pageSize: 10,
        },
      }),
    placeholderData: (previous) => previous,
  });
}

export function useMyReview(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...key(productId), 'mine'],
    queryFn: () =>
      api('/reviews/mine', {
        schema: z.object({ review: ProductReviewSchema.nullable() }),
        query: { productId },
      }),
    enabled,
  });
}

/** Every review mutation refreshes the product's lists, summary and "my review". */
function useReviewMutation<TInput>(productId: string, fn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(productId) }),
  });
}

export const useSaveReview = (productId: string) =>
  useReviewMutation(productId, ({ id, input }: { id: string | null; input: ReviewInput }) =>
    id
      ? api(`/reviews/${id}`, { method: 'PATCH', body: input, schema: ProductReviewSchema })
      : api('/reviews', {
          method: 'POST',
          body: { productId, ...input },
          schema: ProductReviewSchema,
        }),
  );

export const useDeleteReview = (productId: string) =>
  useReviewMutation(productId, (id: string) =>
    api(`/reviews/${id}`, { method: 'DELETE', schema: z.undefined() }),
  );

export const useVoteReview = (productId: string) =>
  useReviewMutation(
    productId,
    ({ id, vote }: { id: string; vote: 'helpful' | 'not_helpful' | null }) =>
      api(`/reviews/${id}/vote`, { method: 'PUT', body: { vote }, schema: ProductReviewSchema }),
  );

export const useReportReview = (productId: string) =>
  useReviewMutation(productId, (id: string) =>
    api(`/reviews/${id}/report`, {
      method: 'POST',
      body: { reason: 'spam' },
      schema: z.undefined(),
    }),
  );
