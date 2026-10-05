'use client';

import {
  IDEMPOTENCY_KEY_HEADER,
  ORDER_TOKEN_HEADER,
  OrderSchema,
  OrderSummarySchema,
  PlacedOrderSchema,
  type CheckoutRequest,
} from '@market/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';
import { CART_QUERY_KEY } from './cart';

const OrderPageSchema = z.object({
  items: z.array(OrderSummarySchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
  totalPages: z.int(),
});

/**
 * Guest order access tokens live in sessionStorage for the tab that placed the
 * order (so the confirmation page can load it). They grant read/cancel on that one
 * order only; signed-in shoppers never need one.
 */
const tokenKey = (orderId: string) => `cse_order_token:${orderId}`;

export function rememberOrderToken(orderId: string, token: string): void {
  try {
    sessionStorage.setItem(tokenKey(orderId), token);
  } catch {
    // Storage unavailable (private mode): the guest will see "sign in or check your email".
  }
}

function orderTokenHeader(orderId: string): Record<string, string> {
  try {
    const token = sessionStorage.getItem(tokenKey(orderId));
    return token ? { [ORDER_TOKEN_HEADER]: token } : {};
  } catch {
    return {};
  }
}

export const orderQueryKey = (orderId: string) => ['order', orderId] as const;

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderQueryKey(orderId),
    queryFn: () =>
      api(`/orders/${orderId}`, { schema: OrderSchema, headers: orderTokenHeader(orderId) }),
  });
}

export function useMyOrders(page: number) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => api('/orders', { schema: OrderPageSchema, query: { page, pageSize: 10 } }),
  });
}

/**
 * Places the order. The idempotency key is created once per checkout attempt by
 * the caller, so a double click or a network retry cannot order twice.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CheckoutRequest; idempotencyKey: string }) =>
      api('/orders', {
        method: 'POST',
        body: input,
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        schema: PlacedOrderSchema,
      }),
    onSuccess: (order) => {
      if (order.accessToken) rememberOrderToken(order.id, order.accessToken);
      const { accessToken: _token, ...visible } = order;
      queryClient.setQueryData(orderQueryKey(order.id), visible);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      // Price or availability may have changed: show the shopper the current cart.
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(`/orders/${orderId}/cancel`, {
        method: 'POST',
        schema: OrderSchema,
        headers: orderTokenHeader(orderId),
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(orderQueryKey(orderId), order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
