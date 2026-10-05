import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * inventory-service owns the `inventory` database. Invariants are enforced by the
 * database itself, so even a bug in application code cannot oversell:
 *   0 <= reserved <= on_hand
 */

export { outboxEvents } from '@market/db';

export const inventoryItems = pgTable(
  'inventory',
  {
    /** One row per sellable product variant (ids come from product-service). */
    variantId: uuid('variant_id').primaryKey(),
    sku: text('sku').notNull(),
    /** Physically in the warehouse, including units held by active reservations. */
    onHand: integer('on_hand').notNull().default(0),
    /** Held by active (unpaid) reservations. Available = on_hand - reserved. */
    reserved: integer('reserved').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('inventory_sku_key').on(t.sku),
    check('inventory_on_hand_non_negative', sql`${t.onHand} >= 0`),
    check('inventory_reserved_non_negative', sql`${t.reserved} >= 0`),
    check('inventory_reserved_within_on_hand', sql`${t.reserved} <= ${t.onHand}`),
    check('inventory_threshold_non_negative', sql`${t.lowStockThreshold} >= 0`),
  ],
);

export const reservationStatus = pgEnum('reservation_status', [
  'ACTIVE',
  'CONFIRMED',
  'RELEASED',
  'EXPIRED',
]);

export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** One reservation per order: retries of the same checkout are idempotent. */
    orderId: uuid('order_id').notNull(),
    status: reservationStatus('status').notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releaseReason: text('release_reason'),
  },
  (t) => [
    uniqueIndex('inventory_reservations_order_key').on(t.orderId),
    // The expiry sweeper only ever scans active reservations by deadline.
    index('inventory_reservations_active_expiry_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} = 'ACTIVE'`),
  ],
);

export const reservationItems = pgTable(
  'inventory_reservation_items',
  {
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => inventoryReservations.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => inventoryItems.variantId, { onDelete: 'restrict' }),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reservationId, t.variantId] }),
    check('inventory_reservation_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

export const movementType = pgEnum('stock_movement_type', [
  'RECEIVED',
  'ADJUSTMENT',
  'RESERVED',
  'RELEASED',
  'EXPIRED',
  'SOLD',
]);

/** Append-only ledger: every change to on_hand or reserved, with who and why. */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => inventoryItems.variantId, { onDelete: 'restrict' }),
    sku: text('sku').notNull(),
    type: movementType('type').notNull(),
    onHandDelta: integer('on_hand_delta').notNull(),
    reservedDelta: integer('reserved_delta').notNull(),
    onHandAfter: integer('on_hand_after').notNull(),
    reservedAfter: integer('reserved_after').notNull(),
    reservationId: uuid('reservation_id'),
    orderId: uuid('order_id'),
    reason: text('reason'),
    /** User id for manual changes, `system` for automatic ones. */
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stock_movements_variant_idx').on(t.variantId, t.createdAt)],
);

export type InventoryRow = typeof inventoryItems.$inferSelect;
export type ReservationRow = typeof inventoryReservations.$inferSelect;
export type MovementRow = typeof stockMovements.$inferSelect;
