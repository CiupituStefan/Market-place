import { z } from 'zod';
import { MoneySchema } from './money.js';

export const PAYMENT_STATUSES = [
  'REQUIRES_PAYMENT',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * What the browser needs to render Stripe's Payment Element for an order. The
 * amount is the order total from order-service; the browser never sends one.
 */
export const PaymentSessionSchema = z.object({
  paymentId: z.uuid(),
  provider: z.enum(['stripe', 'mock']),
  publishableKey: z.string(),
  clientSecret: z.string(),
  amount: MoneySchema,
  status: PaymentStatusSchema,
});
export type PaymentSession = z.infer<typeof PaymentSessionSchema>;

export const RefundReasonSchema = z.enum([
  'requested_by_customer',
  'duplicate',
  'fraudulent',
  'order_unfulfillable',
]);
export type RefundReason = z.infer<typeof RefundReasonSchema>;

export const RefundSchema = z.object({
  id: z.uuid(),
  amount: MoneySchema,
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});

export const PaymentSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  orderNumber: z.string(),
  provider: z.string(),
  providerPaymentId: z.string().nullable(),
  status: PaymentStatusSchema,
  amount: MoneySchema,
  refunded: MoneySchema,
  lastError: z.string().nullable(),
  succeededAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  refunds: z.array(RefundSchema),
});
export type Payment = z.infer<typeof PaymentSchema>;
