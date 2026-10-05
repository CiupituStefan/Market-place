import { DomainError, ErrorCode, type OrderStatus } from '@market/types';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/database.js';
import {
  orderItems,
  orders,
  orderStatusHistory,
  type HistoryRow,
  type OrderItemRow,
  type OrderRow,
} from '../db/schema.js';
import { assertTransition } from './status.js';

/** Small persistence helpers shared by the order services; all take the caller's transaction. */

export async function lockOrder(tx: Database, orderId: string): Promise<OrderRow> {
  const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
  if (!row) throw new DomainError(ErrorCode.ORDER_NOT_FOUND, 'Order not found');
  return row;
}

/**
 * Moves an order to `to` (validated by the state machine), applying `changes`,
 * and records who did it. Callers hold the row lock from `lockOrder`.
 */
export async function transition(
  tx: Database,
  order: OrderRow,
  to: OrderStatus,
  meta: { actor: string; note?: string | null; changes?: Partial<OrderRow> },
): Promise<OrderRow> {
  assertTransition(order.status, to);
  const [updated] = await tx
    .update(orders)
    .set({ ...meta.changes, status: to, updatedAt: new Date() })
    .where(eq(orders.id, order.id))
    .returning();
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: to,
    note: meta.note ?? null,
    actor: meta.actor,
  });
  if (!updated) throw new Error(`order ${order.id} vanished during a transition`);
  return updated;
}

/** A timeline note without a status change (e.g. a failed payment attempt). */
export async function note(
  tx: Database,
  order: OrderRow,
  text: string,
  actor: string,
): Promise<void> {
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: order.status,
    note: text,
    actor,
  });
}

export async function loadItems(
  db: Database,
  orderIds: string[],
): Promise<Map<string, OrderItemRow[]>> {
  const byOrder = new Map<string, OrderItemRow[]>(orderIds.map((id) => [id, []]));
  if (orderIds.length === 0) return byOrder;
  const rows = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.position));
  for (const row of rows) byOrder.get(row.orderId)?.push(row);
  return byOrder;
}

export async function loadHistory(db: Database, orderId: string): Promise<HistoryRow[]> {
  return db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(asc(orderStatusHistory.id));
}
