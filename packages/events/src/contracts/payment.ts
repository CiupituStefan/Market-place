import { MoneySchema } from '@market/types';
import { z } from 'zod';
import { defineEvent } from '../define.js';
import { Topics } from '../topics.js';

/**
 * Payment events never carry card data: only Stripe identifiers, amounts and status.
 */
const PaymentRef = z.object({
  paymentId: z.uuid(),
  orderId: z.uuid(),
  stripePaymentIntentId: z.string().startsWith('pi_'),
  amount: MoneySchema,
});

export const PaymentCreatedV1 = defineEvent({
  type: 'PaymentCreated',
  version: 1,
  topic: Topics.PAYMENT,
  payload: PaymentRef,
});

export const PaymentSucceededV1 = defineEvent({
  type: 'PaymentSucceeded',
  version: 1,
  topic: Topics.PAYMENT,
  payload: PaymentRef.extend({
    /** Stripe event ID that confirmed the payment (webhook idempotency key). */
    stripeEventId: z.string().startsWith('evt_'),
    succeededAt: z.iso.datetime(),
  }),
});

export const PaymentFailedV1 = defineEvent({
  type: 'PaymentFailed',
  version: 1,
  topic: Topics.PAYMENT,
  payload: PaymentRef.extend({
    stripeEventId: z.string().startsWith('evt_'),
    failureCode: z.string().nullable(),
    failureMessage: z.string().nullable(),
  }),
});

export const PaymentRefundedV1 = defineEvent({
  type: 'PaymentRefunded',
  version: 1,
  topic: Topics.PAYMENT,
  payload: PaymentRef.extend({
    refundId: z.uuid(),
    stripeRefundId: z.string().startsWith('re_'),
    refunded: MoneySchema,
    totalRefunded: MoneySchema,
    isFullRefund: z.boolean(),
  }),
});
