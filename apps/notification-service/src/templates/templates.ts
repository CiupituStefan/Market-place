import { NOTIFICATION_TEMPLATES } from '@market/events';
import { z } from 'zod';
import type { EmailContent } from './blocks.js';

/**
 * Every email the shop sends. The event contract lists the templates other
 * services may request; the rest are triggered by notification-service itself.
 */
export const TEMPLATES = [
  ...NOTIFICATION_TEMPLATES,
  'ORDER_CANCELLED',
  'NEWSLETTER_CONFIRM',
] as const;
export type TemplateName = (typeof TEMPLATES)[number];

/**
 * - security / transactional: always sent (the customer needs them);
 * - order-updates: shipping and delivery, can be switched off per account;
 * - newsletter: only to confirmed subscribers.
 */
export type Category = 'security' | 'transactional' | 'order-updates' | 'newsletter';

const MoneyData = z.object({ amount: z.int(), currency: z.string().length(3) });
type MoneyData = z.infer<typeof MoneyData>;

export function formatMoney(money: MoneyData): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: money.currency }).format(
    money.amount / 100,
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso));
}

const greeting = (firstName: string | null | undefined) =>
  firstName ? `Hi ${firstName},` : 'Hi there,';

const OrderData = z.object({
  orderId: z.uuid(),
  orderNumber: z.string(),
  firstName: z.string().nullish(),
});

const OrderSummaryData = z.object({
  lines: z.array(
    z.object({ name: z.string(), sku: z.string(), quantity: z.int(), unitPrice: MoneyData }),
  ),
  subtotal: MoneyData,
  discount: MoneyData,
  shipping: MoneyData,
  tax: MoneyData,
  total: MoneyData,
  couponCode: z.string().nullable(),
});

export interface TemplateContext {
  webUrl: string;
}

interface TemplateDefinition<S extends z.ZodType> {
  category: Category;
  data: S;
  render: (data: z.infer<S>, context: TemplateContext) => EmailContent;
}

const define = <S extends z.ZodType>(definition: TemplateDefinition<S>) => definition;

const orderUrl = (context: TemplateContext, orderId: string) =>
  new URL(`/order/${orderId}`, context.webUrl).toString();

export const templateDefinitions = {
  EMAIL_VERIFICATION: define({
    category: 'security',
    data: z.object({ firstName: z.string().nullish(), link: z.url(), expiresAt: z.iso.datetime() }),
    render: (data) => ({
      subject: 'Confirm your email address',
      preheader: 'One click and your account is ready.',
      blocks: [
        { type: 'heading', text: 'Confirm your email' },
        { type: 'text', text: greeting(data.firstName) },
        {
          type: 'text',
          text: 'Thanks for creating a CSE Keyboards account. Confirm your email address so you can write reviews and recover your account if you ever need to.',
        },
        { type: 'button', label: 'Confirm email', href: data.link },
        {
          type: 'note',
          text: `This link works once and expires on ${formatDate(data.expiresAt)}. If you did not create an account, you can ignore this email.`,
        },
      ],
    }),
  }),

  PASSWORD_RESET: define({
    category: 'security',
    data: z.object({ firstName: z.string().nullish(), link: z.url(), expiresAt: z.iso.datetime() }),
    render: (data) => ({
      subject: 'Reset your password',
      preheader: 'Use this link to choose a new password.',
      blocks: [
        { type: 'heading', text: 'Reset your password' },
        { type: 'text', text: greeting(data.firstName) },
        {
          type: 'text',
          text: 'Someone (hopefully you) asked to reset the password of your CSE Keyboards account.',
        },
        { type: 'button', label: 'Choose a new password', href: data.link },
        {
          type: 'note',
          text: `This link works once and expires on ${formatDate(data.expiresAt)}. If you did not ask for it, ignore this email: your password stays the same. Resetting signs you out everywhere.`,
        },
      ],
    }),
  }),

  ORDER_CONFIRMATION: define({
    category: 'transactional',
    data: OrderData.extend({ summary: OrderSummaryData, paidAt: z.iso.datetime() }),
    render: (data, context) => {
      const { summary } = data;
      return {
        subject: `Order ${data.orderNumber} confirmed`,
        preheader: `We received your payment of ${formatMoney(summary.total)}.`,
        blocks: [
          { type: 'heading', text: 'Thanks for your order!' },
          {
            type: 'text',
            text: `Payment received on ${formatDate(data.paidAt)}. We are getting order ${data.orderNumber} ready and will email you the tracking number as soon as it ships.`,
          },
          {
            type: 'rows',
            rows: summary.lines.map((line) => ({
              label: `${line.quantity} × ${line.name}`,
              value: formatMoney({
                amount: line.unitPrice.amount * line.quantity,
                currency: line.unitPrice.currency,
              }),
            })),
          },
          {
            type: 'rows',
            rows: [
              { label: 'Subtotal', value: formatMoney(summary.subtotal) },
              ...(summary.discount.amount > 0
                ? [
                    {
                      label: summary.couponCode ? `Discount (${summary.couponCode})` : 'Discount',
                      value: `−${formatMoney(summary.discount)}`,
                    },
                  ]
                : []),
              {
                label: 'Shipping',
                value: summary.shipping.amount === 0 ? 'Free' : formatMoney(summary.shipping),
              },
              { label: 'VAT included', value: formatMoney(summary.tax) },
              { label: 'Total paid', value: formatMoney(summary.total), strong: true },
            ],
          },
          { type: 'button', label: 'View your order', href: orderUrl(context, data.orderId) },
        ],
      };
    },
  }),

  ORDER_SHIPPED: define({
    category: 'order-updates',
    data: OrderData.extend({
      carrier: z.string(),
      trackingNumber: z.string(),
      trackingUrl: z.url().nullable(),
    }),
    render: (data, context) => ({
      subject: `Order ${data.orderNumber} is on its way`,
      preheader: `${data.carrier} tracking number ${data.trackingNumber}.`,
      blocks: [
        { type: 'heading', text: 'Your keyboard is on its way' },
        { type: 'text', text: greeting(data.firstName) },
        {
          type: 'text',
          text: `Order ${data.orderNumber} left our workshop with ${data.carrier}. Tracking number: ${data.trackingNumber}.`,
        },
        data.trackingUrl
          ? { type: 'button', label: 'Track your parcel', href: data.trackingUrl }
          : { type: 'button', label: 'View your order', href: orderUrl(context, data.orderId) },
      ],
    }),
  }),

  ORDER_DELIVERED: define({
    category: 'order-updates',
    data: OrderData,
    render: (data, context) => ({
      subject: `Order ${data.orderNumber} was delivered`,
      preheader: 'Enjoy the new board. Tell other typists what you think.',
      blocks: [
        { type: 'heading', text: 'Delivered!' },
        { type: 'text', text: greeting(data.firstName) },
        {
          type: 'text',
          text: `Order ${data.orderNumber} has been delivered. Once you have typed on it for a while, a review helps other enthusiasts choose.`,
        },
        { type: 'button', label: 'View your order', href: orderUrl(context, data.orderId) },
      ],
    }),
  }),

  ORDER_CANCELLED: define({
    category: 'transactional',
    data: OrderData.extend({
      reason: z.enum(['CUSTOMER_REQUEST', 'ADMIN', 'OUT_OF_STOCK']),
      refundRequired: z.boolean(),
    }),
    render: (data, context) => {
      const why = {
        CUSTOMER_REQUEST: 'as you requested',
        ADMIN: 'by our team',
        OUT_OF_STOCK: 'because an item is no longer in stock',
      }[data.reason];
      return {
        subject: `Order ${data.orderNumber} was cancelled`,
        preheader: data.refundRequired
          ? 'Your payment will be refunded.'
          : 'No payment was taken for it.',
        blocks: [
          { type: 'heading', text: 'Order cancelled' },
          { type: 'text', text: `Order ${data.orderNumber} was cancelled ${why}.` },
          {
            type: 'text',
            text: data.refundRequired
              ? 'We are refunding your payment in full; you will get another email when the refund is issued.'
              : 'You have not been charged.',
          },
          { type: 'button', label: 'View your order', href: orderUrl(context, data.orderId) },
        ],
      };
    },
  }),

  PAYMENT_FAILED: define({
    category: 'transactional',
    data: OrderData.extend({ failureMessage: z.string().nullable() }),
    render: (data, context) => ({
      subject: `Payment for order ${data.orderNumber} did not go through`,
      preheader: 'Your items are still held for a short while.',
      blocks: [
        { type: 'heading', text: 'Your payment did not go through' },
        {
          type: 'text',
          text: `We could not take the payment for order ${data.orderNumber}${data.failureMessage ? `: ${data.failureMessage}` : '.'}`,
        },
        {
          type: 'text',
          text: 'Your items stay reserved until the payment window closes. You can try again with the same or another payment method.',
        },
        { type: 'button', label: 'Try again', href: orderUrl(context, data.orderId) },
      ],
    }),
  }),

  REFUND_ISSUED: define({
    category: 'transactional',
    data: OrderData.extend({
      refunded: MoneyData,
      totalRefunded: MoneyData,
      isFullRefund: z.boolean(),
    }),
    render: (data, context) => ({
      subject: `Refund of ${formatMoney(data.refunded)} for order ${data.orderNumber}`,
      preheader: 'Refunds usually appear on your statement within 5–10 business days.',
      blocks: [
        { type: 'heading', text: 'Refund issued' },
        {
          type: 'text',
          text: data.isFullRefund
            ? `Order ${data.orderNumber} has been refunded in full (${formatMoney(data.totalRefunded)}).`
            : `We refunded ${formatMoney(data.refunded)} for order ${data.orderNumber} (${formatMoney(data.totalRefunded)} refunded so far).`,
        },
        {
          type: 'note',
          text: 'The money goes back to the payment method you used. Depending on your bank this takes 5–10 business days.',
        },
        { type: 'button', label: 'View your order', href: orderUrl(context, data.orderId) },
      ],
    }),
  }),

  NEWSLETTER_CONFIRM: define({
    category: 'security',
    data: z.object({ link: z.url() }),
    render: (data) => ({
      subject: 'Confirm your CSE Keyboards newsletter subscription',
      preheader: 'One click to start getting group buys, restocks and build guides.',
      blocks: [
        { type: 'heading', text: 'Confirm your subscription' },
        {
          type: 'text',
          text: 'Someone asked to subscribe this address to the CSE Keyboards newsletter: one email a month with restocks, new boards and build guides.',
        },
        { type: 'button', label: 'Yes, subscribe me', href: data.link },
        {
          type: 'note',
          text: 'If it was not you, ignore this email and you will not hear from us again.',
        },
      ],
    }),
  }),

  NEWSLETTER_WELCOME: define({
    category: 'newsletter',
    data: z.object({}),
    render: (_data, context) => ({
      subject: 'Welcome to the CSE Keyboards newsletter',
      preheader: 'You are on the list.',
      blocks: [
        { type: 'heading', text: 'You are on the list' },
        {
          type: 'text',
          text: 'Thanks for subscribing. Expect one email a month: restocks, new boards, switch reviews and build guides. No spam.',
        },
        {
          type: 'button',
          label: 'Browse keyboards',
          href: new URL('/shop', context.webUrl).toString(),
        },
      ],
    }),
  }),
} satisfies Record<TemplateName, TemplateDefinition<z.ZodType>>;

export function isTemplate(name: string): name is TemplateName {
  return (TEMPLATES as readonly string[]).includes(name);
}

/** Validates stored data against the template's schema (throws if invalid) and renders it. */
export function renderTemplate(
  name: TemplateName,
  data: unknown,
  context: TemplateContext,
): EmailContent {
  const definition: TemplateDefinition<z.ZodType> = templateDefinitions[name];
  return definition.render(definition.data.parse(data), context);
}
