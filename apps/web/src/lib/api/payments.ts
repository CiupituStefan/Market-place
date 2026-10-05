'use client';

import { ORDER_TOKEN_HEADER, PaymentSessionSchema } from '@market/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';

function orderTokenHeader(orderId: string): Record<string, string> {
  try {
    const token = sessionStorage.getItem(`cse_order_token:${orderId}`);
    return token ? { [ORDER_TOKEN_HEADER]: token } : {};
  } catch {
    return {};
  }
}

/**
 * The payment session (PaymentIntent client secret) for an unpaid order. The
 * server reuses one intent per order, so refetching is safe; the amount is the
 * order total from the server, never something the browser sends.
 */
export function usePaymentSession(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['payment-session', orderId],
    queryFn: () =>
      api('/payments/create-intent', {
        method: 'POST',
        body: { orderId },
        headers: orderTokenHeader(orderId),
        schema: PaymentSessionSchema,
      }),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

/** Local development only (mock provider): simulates the shopper confirming in Stripe. */
export function useMockConfirm() {
  return useMutation({
    mutationFn: (input: { clientSecret: string; outcome: 'succeed' | 'fail' }) =>
      api('/payments/mock/confirm', { method: 'POST', body: input, schema: z.unknown() }),
  });
}
