/**
 * The payment processor as payment-service sees it. Stripe in every real
 * environment; an in-process mock for local development without Stripe keys.
 * Card details never pass through this interface (or our servers): they go
 * from Stripe's Payment Element straight to Stripe.
 */

export type IntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export interface Intent {
  id: string;
  clientSecret: string;
  status: IntentStatus;
  amount: number;
  /** ISO 4217, upper case (Stripe uses lower case on the wire). */
  currency: string;
}

export interface IntentRequest {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  email: string;
}

export type RefundStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled';

export interface ProviderRefund {
  id: string;
  status: RefundStatus;
  amount: number;
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'mock';
  /** Given to the browser to load Stripe.js (`mock` for the local stand-in). */
  readonly publishableKey: string;
  /** Idempotent per key: a retried create returns the same intent. */
  createIntent(request: IntentRequest, idempotencyKey: string): Promise<Intent>;
  retrieveIntent(id: string): Promise<Intent>;
  cancelIntent(id: string): Promise<void>;
  createRefund(
    request: { paymentIntentId: string; amount: number; refundId: string; reason: string },
    idempotencyKey: string,
  ): Promise<ProviderRefund>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
