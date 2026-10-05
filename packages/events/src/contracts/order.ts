import { CancelReasonSchema, MoneySchema, ShippingCountrySchema } from '@market/types';
import { z } from 'zod';
import { defineEvent } from '../define.js';
import { Topics } from '../topics.js';

/** A catalog variant, or a configurator build (built to order, no variant id). */
const OrderLine = z.object({
  kind: z.enum(['variant', 'configuration']),
  variantId: z.uuid().nullable(),
  configurationId: z.string().nullable(),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.int().positive(),
  unitPrice: MoneySchema,
});

export const OrderCreatedV1 = defineEvent({
  type: 'OrderCreated',
  version: 1,
  topic: Topics.ORDER,
  payload: z.object({
    orderId: z.uuid(),
    orderNumber: z.string().min(1),
    userId: z.uuid().nullable(),
    email: z.email(),
    lines: z.array(OrderLine).min(1),
    shippingCountry: ShippingCountrySchema,
    couponCode: z.string().nullable(),
    subtotal: MoneySchema,
    discount: MoneySchema,
    shipping: MoneySchema,
    tax: MoneySchema,
    total: MoneySchema,
  }),
});

export const OrderPaidV1 = defineEvent({
  type: 'OrderPaid',
  version: 1,
  topic: Topics.ORDER,
  payload: z.object({
    orderId: z.uuid(),
    orderNumber: z.string().min(1),
    paymentId: z.uuid(),
    /** Null when the order only contains built-to-order items. */
    reservationId: z.uuid().nullable(),
    total: MoneySchema,
    paidAt: z.iso.datetime(),
  }),
});

export const OrderCancelledV1 = defineEvent({
  type: 'OrderCancelled',
  version: 1,
  topic: Topics.ORDER,
  payload: z.object({
    orderId: z.uuid(),
    orderNumber: z.string().min(1),
    reservationId: z.uuid().nullable(),
    reason: CancelReasonSchema,
    /** A payment was captured for this order and must be refunded (payment-service). */
    refundRequired: z.boolean(),
  }),
});

export const OrderShippedV1 = defineEvent({
  type: 'OrderShipped',
  version: 1,
  topic: Topics.ORDER,
  payload: z.object({
    orderId: z.uuid(),
    carrier: z.string().min(1),
    trackingNumber: z.string().min(1),
    trackingUrl: z.url().nullable(),
    shippedAt: z.iso.datetime(),
  }),
});

export const OrderDeliveredV1 = defineEvent({
  type: 'OrderDelivered',
  version: 1,
  topic: Topics.ORDER,
  payload: z.object({
    orderId: z.uuid(),
    deliveredAt: z.iso.datetime(),
  }),
});
