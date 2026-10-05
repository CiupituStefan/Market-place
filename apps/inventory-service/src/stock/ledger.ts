import { enqueueEvent } from '@market/db';
import { InventoryStockChangedV1 } from '@market/events';
import { eq, sql } from 'drizzle-orm';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';
import { inventoryItems, stockMovements, type InventoryRow } from '../db/schema.js';
import { availableOf, stockStatus } from './levels.js';

export interface StockChange {
  type: (typeof stockMovements.$inferInsert)['type'];
  onHandDelta: number;
  reservedDelta: number;
  actor: string;
  reason?: string | null;
  reservationId?: string | null;
  orderId?: string | null;
}

/**
 * The only way stock changes: an atomic relative update (the CHECK constraints
 * reject anything that would go negative or over-reserve), a ledger entry with
 * the resulting levels, and a stock-changed event, all in the caller's transaction.
 * The caller must already hold the row lock (SELECT ... FOR UPDATE).
 */
export async function applyStockChange(
  tx: Database,
  variantId: string,
  change: StockChange,
): Promise<InventoryRow> {
  const [row] = await tx
    .update(inventoryItems)
    .set({
      onHand: sql`${inventoryItems.onHand} + ${change.onHandDelta}`,
      reserved: sql`${inventoryItems.reserved} + ${change.reservedDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.variantId, variantId))
    .returning();
  if (!row) throw new Error(`inventory row ${variantId} disappeared while locked`);

  await tx.insert(stockMovements).values({
    variantId,
    sku: row.sku,
    type: change.type,
    onHandDelta: change.onHandDelta,
    reservedDelta: change.reservedDelta,
    onHandAfter: row.onHand,
    reservedAfter: row.reserved,
    reservationId: change.reservationId ?? null,
    orderId: change.orderId ?? null,
    reason: change.reason ?? null,
    actor: change.actor,
  });

  const available = availableOf(row);
  await enqueueEvent(
    tx,
    InventoryStockChangedV1,
    {
      variantId,
      sku: row.sku,
      onHand: row.onHand,
      reserved: row.reserved,
      available,
      availability: stockStatus(available, row.lowStockThreshold),
    },
    { producer: SERVICE_NAME, aggregateId: variantId },
  );
  return row;
}
