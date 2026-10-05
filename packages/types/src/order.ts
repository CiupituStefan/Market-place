import { z } from 'zod';
import { ConfigurationSelectionSchema, ProductPreviewSchema } from './catalog.js';
import { MoneySchema } from './money.js';

/**
 * Order lifecycle. PENDING and FAILED are internal checkout states and never shown
 * to customers: an order becomes visible once stock is held (PENDING_PAYMENT).
 */
export const ORDER_STATUSES = [
  'PENDING',
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'FAILED',
] as const;
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const CANCEL_REASONS = [
  'CUSTOMER_REQUEST',
  'PAYMENT_TIMEOUT',
  'PAYMENT_FAILED',
  'OUT_OF_STOCK',
  'ADMIN',
] as const;
export const CancelReasonSchema = z.enum(CANCEL_REASONS);
export type CancelReason = z.infer<typeof CancelReasonSchema>;

/** Countries we ship to (EU). ISO 3166-1 alpha-2. */
export const SHIPPING_COUNTRIES = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
} as const;
export type ShippingCountry = keyof typeof SHIPPING_COUNTRIES;
export const ShippingCountrySchema = z.enum(
  Object.keys(SHIPPING_COUNTRIES) as [ShippingCountry, ...ShippingCountry[]],
);

const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Required')
    .max(max, `At most ${String(max)} characters`);

export const AddressSchema = z
  .object({
    firstName: line(80),
    lastName: line(80),
    company: z.string().trim().max(120).nullable().default(null),
    line1: line(200),
    line2: z.string().trim().max(200).nullable().default(null),
    city: line(100),
    postalCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}$/, 'Enter a valid postal code'),
    region: z.string().trim().max(100).nullable().default(null),
    country: ShippingCountrySchema,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a valid phone number')
      .nullable()
      .default(null),
  })
  .strict();
export type Address = z.infer<typeof AddressSchema>;

/**
 * What the browser sends to place an order. No prices: `expectedTotal` is only the
 * total the shopper saw, so a change since then is reported instead of charged.
 */
export const CheckoutRequestSchema = z
  .object({
    email: z.email('Enter a valid email address').max(254),
    shippingAddress: AddressSchema,
    /** Null: same as shipping. */
    billingAddress: AddressSchema.nullable().default(null),
    expectedTotal: z.int().nonnegative(),
    notes: z.string().trim().max(500).nullable().default(null),
  })
  .strict();
export type CheckoutRequest = z.input<typeof CheckoutRequestSchema>;

export const OrderItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['variant', 'configuration']),
  variantId: z.uuid().nullable(),
  configurationId: z.string().nullable(),
  configurator: z.string().nullable(),
  selection: ConfigurationSelectionSchema.nullable(),
  productSlug: z.string().nullable(),
  sku: z.string(),
  name: z.string(),
  optionsLabel: z.string(),
  preview: ProductPreviewSchema,
  imageUrl: z.string().nullable(),
  quantity: z.int().positive(),
  unitPrice: MoneySchema,
  lineTotal: MoneySchema,
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderHistoryEntrySchema = z.object({
  status: OrderStatusSchema,
  note: z.string().nullable(),
  at: z.iso.datetime(),
});

export const OrderSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: OrderStatusSchema,
  email: z.string(),
  items: z.array(OrderItemSchema),
  subtotal: MoneySchema,
  discount: MoneySchema,
  shipping: MoneySchema,
  /** VAT contained in the total, at the destination country's rate. */
  tax: MoneySchema,
  vatRateBps: z.int().nonnegative(),
  total: MoneySchema,
  couponCode: z.string().nullable(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  notes: z.string().nullable(),
  /** Stock is held until then; unpaid orders are cancelled afterwards. */
  paymentDueAt: z.iso.datetime().nullable(),
  paidAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: CancelReasonSchema.nullable(),
  carrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  history: z.array(OrderHistoryEntrySchema),
  createdAt: z.iso.datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

/** Response to placing an order. Guests get a one-time access token for that order. */
export const PlacedOrderSchema = OrderSchema.extend({
  accessToken: z.string().nullable(),
});
export type PlacedOrder = z.infer<typeof PlacedOrderSchema>;

export const OrderSummarySchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: OrderStatusSchema,
  email: z.string(),
  itemCount: z.int().nonnegative(),
  total: MoneySchema,
  previews: z.array(ProductPreviewSchema).max(4),
  createdAt: z.iso.datetime(),
});
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

/** Header carrying a guest's order access token. */
export const ORDER_TOKEN_HEADER = 'x-order-token';
