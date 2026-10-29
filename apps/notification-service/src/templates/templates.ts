import { NOTIFICATION_TEMPLATES } from '@market/events';
import { localizedPath, type Locale } from '@market/types';
import { z } from 'zod';
import type { EmailContent } from './blocks.js';
import { COPY, INTL } from './copy.js';

/**
 * Every email the shop sends. The event contract lists the templates other
 * services may request; the rest are triggered by notification-service itself.
 * Each is written in English and Romanian (copy.ts); the language travels with the request.
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

export function formatMoney(money: MoneyData, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(INTL[locale], {
    style: 'currency',
    currency: money.currency,
  }).format(money.amount / 100);
}

export function formatDate(iso: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : INTL[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso));
}

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
  locale: Locale;
}

/** What a template's render function gets besides its data: copy, formatters and links. */
interface Helpers {
  c: (typeof COPY)[Locale];
  money: (money: MoneyData) => string;
  date: (iso: string) => string;
  /** Absolute storefront URL of a page, in the email's language. */
  page: (path: string) => string;
}

interface TemplateDefinition<S extends z.ZodType> {
  category: Category;
  data: S;
  render: (data: z.infer<S>, helpers: Helpers) => EmailContent;
}

const define = <S extends z.ZodType>(definition: TemplateDefinition<S>) => definition;

export const templateDefinitions = {
  EMAIL_VERIFICATION: define({
    category: 'security',
    data: z.object({ firstName: z.string().nullish(), link: z.url(), expiresAt: z.iso.datetime() }),
    render: (data, { c, date }) => ({
      subject: c.verification.subject,
      preheader: c.verification.preheader,
      blocks: [
        { type: 'heading', text: c.verification.heading },
        { type: 'text', text: c.greeting(data.firstName) },
        { type: 'text', text: c.verification.body },
        { type: 'button', label: c.verification.button, href: data.link },
        { type: 'note', text: c.verification.note(date(data.expiresAt)) },
      ],
    }),
  }),

  PASSWORD_RESET: define({
    category: 'security',
    data: z.object({ firstName: z.string().nullish(), link: z.url(), expiresAt: z.iso.datetime() }),
    render: (data, { c, date }) => ({
      subject: c.reset.subject,
      preheader: c.reset.preheader,
      blocks: [
        { type: 'heading', text: c.reset.heading },
        { type: 'text', text: c.greeting(data.firstName) },
        { type: 'text', text: c.reset.body },
        { type: 'button', label: c.reset.button, href: data.link },
        { type: 'note', text: c.reset.note(date(data.expiresAt)) },
      ],
    }),
  }),

  ORDER_CONFIRMATION: define({
    category: 'transactional',
    data: OrderData.extend({ summary: OrderSummaryData, paidAt: z.iso.datetime() }),
    render: (data, { c, money, date, page }) => {
      const { summary } = data;
      return {
        subject: c.confirmation.subject(data.orderNumber),
        preheader: c.confirmation.preheader(money(summary.total)),
        blocks: [
          { type: 'heading', text: c.confirmation.heading },
          { type: 'text', text: c.confirmation.body(date(data.paidAt), data.orderNumber) },
          {
            type: 'rows',
            rows: summary.lines.map((line) => ({
              label: `${String(line.quantity)} × ${line.name}`,
              value: money({
                amount: line.unitPrice.amount * line.quantity,
                currency: line.unitPrice.currency,
              }),
            })),
          },
          {
            type: 'rows',
            rows: [
              { label: c.totals.subtotal, value: money(summary.subtotal) },
              ...(summary.discount.amount > 0
                ? [
                    {
                      label: c.totals.discount(summary.couponCode),
                      value: `−${money(summary.discount)}`,
                    },
                  ]
                : []),
              {
                label: c.totals.shipping,
                value: summary.shipping.amount === 0 ? c.totals.free : money(summary.shipping),
              },
              { label: c.totals.vat, value: money(summary.tax) },
              { label: c.totals.paid, value: money(summary.total), strong: true },
            ],
          },
          { type: 'button', label: c.viewOrder, href: page(`/order/${data.orderId}`) },
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
    render: (data, { c, page }) => ({
      subject: c.shipped.subject(data.orderNumber),
      preheader: c.shipped.preheader(data.carrier, data.trackingNumber),
      blocks: [
        { type: 'heading', text: c.shipped.heading },
        { type: 'text', text: c.greeting(data.firstName) },
        {
          type: 'text',
          text: c.shipped.body(data.orderNumber, data.carrier, data.trackingNumber),
        },
        data.trackingUrl
          ? { type: 'button', label: c.shipped.track, href: data.trackingUrl }
          : { type: 'button', label: c.viewOrder, href: page(`/order/${data.orderId}`) },
      ],
    }),
  }),

  ORDER_DELIVERED: define({
    category: 'order-updates',
    data: OrderData,
    render: (data, { c, page }) => ({
      subject: c.delivered.subject(data.orderNumber),
      preheader: c.delivered.preheader,
      blocks: [
        { type: 'heading', text: c.delivered.heading },
        { type: 'text', text: c.greeting(data.firstName) },
        { type: 'text', text: c.delivered.body(data.orderNumber) },
        { type: 'button', label: c.viewOrder, href: page(`/order/${data.orderId}`) },
      ],
    }),
  }),

  ORDER_CANCELLED: define({
    category: 'transactional',
    data: OrderData.extend({
      reason: z.enum(['CUSTOMER_REQUEST', 'ADMIN', 'OUT_OF_STOCK']),
      refundRequired: z.boolean(),
    }),
    render: (data, { c, page }) => ({
      subject: c.cancelled.subject(data.orderNumber),
      preheader: data.refundRequired ? c.cancelled.refundPreheader : c.cancelled.noChargePreheader,
      blocks: [
        { type: 'heading', text: c.cancelled.heading },
        { type: 'text', text: c.cancelled.body(data.orderNumber, c.cancelled.why[data.reason]) },
        {
          type: 'text',
          text: data.refundRequired ? c.cancelled.refund : c.cancelled.noCharge,
        },
        { type: 'button', label: c.viewOrder, href: page(`/order/${data.orderId}`) },
      ],
    }),
  }),

  PAYMENT_FAILED: define({
    category: 'transactional',
    data: OrderData.extend({ failureMessage: z.string().nullable() }),
    render: (data, { c, page }) => ({
      subject: c.paymentFailed.subject(data.orderNumber),
      preheader: c.paymentFailed.preheader,
      blocks: [
        { type: 'heading', text: c.paymentFailed.heading },
        { type: 'text', text: c.paymentFailed.body(data.orderNumber, data.failureMessage) },
        { type: 'text', text: c.paymentFailed.retry },
        { type: 'button', label: c.paymentFailed.button, href: page(`/order/${data.orderId}`) },
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
    render: (data, { c, money, page }) => ({
      subject: c.refund.subject(money(data.refunded), data.orderNumber),
      preheader: c.refund.preheader,
      blocks: [
        { type: 'heading', text: c.refund.heading },
        {
          type: 'text',
          text: data.isFullRefund
            ? c.refund.full(data.orderNumber, money(data.totalRefunded))
            : c.refund.partial(data.orderNumber, money(data.refunded), money(data.totalRefunded)),
        },
        { type: 'note', text: c.refund.note },
        { type: 'button', label: c.viewOrder, href: page(`/order/${data.orderId}`) },
      ],
    }),
  }),

  NEWSLETTER_CONFIRM: define({
    category: 'security',
    data: z.object({ link: z.url() }),
    render: (data, { c }) => ({
      subject: c.newsletterConfirm.subject,
      preheader: c.newsletterConfirm.preheader,
      blocks: [
        { type: 'heading', text: c.newsletterConfirm.heading },
        { type: 'text', text: c.newsletterConfirm.body },
        { type: 'button', label: c.newsletterConfirm.button, href: data.link },
        { type: 'note', text: c.newsletterConfirm.note },
      ],
    }),
  }),

  NEWSLETTER_WELCOME: define({
    category: 'newsletter',
    data: z.object({}),
    render: (_data, { c, page }) => ({
      subject: c.welcome.subject,
      preheader: c.welcome.preheader,
      blocks: [
        { type: 'heading', text: c.welcome.heading },
        { type: 'text', text: c.welcome.body },
        { type: 'button', label: c.welcome.button, href: page('/shop') },
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
  const { locale, webUrl } = context;
  return definition.render(definition.data.parse(data), {
    c: COPY[locale],
    money: (money) => formatMoney(money, locale),
    date: (iso) => formatDate(iso, locale),
    page: (path) => new URL(localizedPath(path, locale), webUrl).toString(),
  });
}
