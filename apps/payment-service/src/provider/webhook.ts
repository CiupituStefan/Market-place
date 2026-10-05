import { DomainError, ErrorCode } from '@market/types';
import Stripe from 'stripe';
import { z } from 'zod';

/** A verified webhook event, reduced to the fields we act on. */
export type ProviderEvent =
  | {
      id: string;
      type: string;
      kind: 'payment_intent';
      intent: {
        id: string;
        status: string;
        amount: number;
        amountReceived: number;
        currency: string;
        lastError: string | null;
        paymentId: string | null;
      };
    }
  | {
      id: string;
      type: string;
      kind: 'refund';
      refund: {
        id: string;
        status: string;
        amount: number;
        paymentIntentId: string | null;
        refundId: string | null;
      };
    }
  | { id: string; type: string; kind: 'other' };

const IntentObject = z.object({
  object: z.literal('payment_intent'),
  id: z.string(),
  status: z.string(),
  amount: z.int(),
  amount_received: z.int().default(0),
  currency: z.string(),
  last_payment_error: z.object({ message: z.string().optional() }).nullable().optional(),
  metadata: z.record(z.string(), z.string()).default({}),
});

const RefundObject = z.object({
  object: z.literal('refund'),
  id: z.string(),
  status: z.string(),
  amount: z.int(),
  payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullable(),
  metadata: z.record(z.string(), z.string()).default({}),
});

/**
 * Verifies the `Stripe-Signature` header (HMAC-SHA256 over the raw body, with a
 * timestamp tolerance against replays) and normalizes the event. The raw bytes
 * must be exactly what Stripe sent: parsed-and-reserialized JSON would not verify.
 */
export function verifyWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
  toleranceSeconds: number,
): ProviderEvent {
  let event: { id: string; type: string; data: { object: unknown } };
  try {
    if (!signature) throw new Error('missing signature');
    event = Stripe.webhooks.constructEvent(rawBody, signature, secret, toleranceSeconds);
  } catch {
    throw new DomainError(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Invalid webhook signature');
  }

  const intent = IntentObject.safeParse(event.data.object);
  if (intent.success) {
    const o = intent.data;
    return {
      id: event.id,
      type: event.type,
      kind: 'payment_intent',
      intent: {
        id: o.id,
        status: o.status,
        amount: o.amount,
        amountReceived: o.amount_received,
        currency: o.currency.toUpperCase(),
        lastError: o.last_payment_error?.message ?? null,
        paymentId: o.metadata.paymentId ?? null,
      },
    };
  }
  const refund = RefundObject.safeParse(event.data.object);
  if (refund.success) {
    const o = refund.data;
    return {
      id: event.id,
      type: event.type,
      kind: 'refund',
      refund: {
        id: o.id,
        status: o.status,
        amount: o.amount,
        paymentIntentId:
          typeof o.payment_intent === 'string' ? o.payment_intent : (o.payment_intent?.id ?? null),
        refundId: o.metadata.refundId ?? null,
      },
    };
  }
  return { id: event.id, type: event.type, kind: 'other' };
}

/** Signs a payload the way Stripe does (tests and the mock provider). */
export function signWebhook(payload: string, secret: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}
