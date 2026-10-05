import { z } from 'zod';
import { CurrencySchema } from './money.js';
import { ProductStatusSchema, ProductSummarySchema } from './catalog.js';
import { RoleSchema } from './roles.js';

/**
 * Back-office contracts shared by the services that serve them and the admin UI.
 * Amounts in analytics are integers in minor units of `currency`.
 */

// ── analytics (admin-service) ────────────────────────────────────────────────

const LocalDate = z.iso.date();

/** Inclusive range of store-local calendar days. */
export const DateRangeQuerySchema = z
  .object({ from: LocalDate, to: LocalDate })
  .refine((r) => r.from <= r.to, { path: ['to'], message: 'Must not be before from' })
  .refine((r) => Date.parse(r.to) - Date.parse(r.from) <= 366 * 86_400_000, {
    path: ['to'],
    message: 'At most one year',
  });
export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

const SalesFigures = z.object({
  /** Totals of orders paid in the range (VAT and shipping included, after discounts). */
  grossSales: z.int(),
  /** Refunds settled in the range. */
  refunds: z.int(),
  netSales: z.int(),
  paidOrders: z.int(),
  /** grossSales / paidOrders, rounded; 0 without orders. */
  averageOrderValue: z.int(),
  discounts: z.int(),
  cancelledOrders: z.int(),
});

export const SalesSummarySchema = SalesFigures.extend({
  from: LocalDate,
  to: LocalDate,
  currency: CurrencySchema,
  timeZone: z.string(),
  /** The same number of days immediately before `from`. */
  previous: SalesFigures,
  /** Orders waiting for payment right now (not range-bound). */
  awaitingPayment: z.int(),
});
export type SalesSummary = z.infer<typeof SalesSummarySchema>;

export const DailySalesSchema = z.object({
  currency: CurrencySchema,
  days: z.array(
    z.object({ date: LocalDate, grossSales: z.int(), refunds: z.int(), paidOrders: z.int() }),
  ),
});
export type DailySales = z.infer<typeof DailySalesSchema>;

export const BestSellerSchema = z.object({
  sku: z.string(),
  name: z.string(),
  variantId: z.uuid().nullable(),
  units: z.int(),
  revenue: z.int(),
});
export type BestSeller = z.infer<typeof BestSellerSchema>;

export const BestSellersSchema = z.object({
  currency: CurrencySchema,
  items: z.array(BestSellerSchema),
});

export const CustomerStatsSchema = z.object({
  userId: z.uuid(),
  currency: CurrencySchema,
  paidOrders: z.int(),
  grossSpent: z.int(),
  refunded: z.int(),
  averageOrderValue: z.int(),
  firstOrderAt: z.iso.datetime().nullable(),
  lastOrderAt: z.iso.datetime().nullable(),
});
export type CustomerStats = z.infer<typeof CustomerStatsSchema>;

// ── accounts (auth-service) ─────────────────────────────────────────────────

/** A user as the back office sees it: never hashes, lockout state or tokens. */
export const UserAccountSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(RoleSchema),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type UserAccount = z.infer<typeof UserAccountSchema>;

// ── catalog (product-service) ───────────────────────────────────────────────

export const ManagedProductSummarySchema = ProductSummarySchema.extend({
  status: ProductStatusSchema,
  variantCount: z.int(),
});
export type ManagedProductSummary = z.infer<typeof ManagedProductSummarySchema>;

// ── inventory (inventory-service) ───────────────────────────────────────────

export const STOCK_STATUSES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const;

export const StockItemSchema = z.object({
  variantId: z.uuid(),
  sku: z.string(),
  onHand: z.int(),
  reserved: z.int(),
  available: z.int(),
  lowStockThreshold: z.int(),
  status: z.enum(STOCK_STATUSES),
  updatedAt: z.iso.datetime(),
});
export type StockItem = z.infer<typeof StockItemSchema>;

export const RESERVATION_STATUSES = ['ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED'] as const;

export const ReservationSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  status: z.enum(RESERVATION_STATUSES),
  expiresAt: z.iso.datetime(),
  lines: z.array(z.object({ variantId: z.uuid(), sku: z.string(), quantity: z.int() })),
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const StockMovementSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  type: z.string(),
  onHandDelta: z.int(),
  reservedDelta: z.int(),
  onHandAfter: z.int(),
  reservedAfter: z.int(),
  orderId: z.uuid().nullable(),
  reason: z.string().nullable(),
  actor: z.string(),
  createdAt: z.iso.datetime(),
});
export type StockMovement = z.infer<typeof StockMovementSchema>;
