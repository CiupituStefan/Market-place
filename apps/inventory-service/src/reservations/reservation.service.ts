import { enqueueEvent, isUniqueViolation } from '@market/db';
import {
  InventoryDecrementedV1,
  InventoryReleasedV1,
  InventoryReservationExpiredV1,
  InventoryReservedV1,
} from '@market/events';
import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import {
  inventoryItems,
  inventoryReservations,
  reservationItems,
  type InventoryRow,
  type ReservationRow,
} from '../db/schema.js';
import { applyStockChange } from '../stock/ledger.js';
import { availableOf, normalizeLines, sameLines, type Line } from '../stock/levels.js';

export type ReleaseReason = 'PAYMENT_FAILED' | 'ORDER_CANCELLED' | 'MANUAL';

export interface ReservationView {
  id: string;
  orderId: string;
  status: ReservationRow['status'];
  expiresAt: string;
  lines: { variantId: string; sku: string; quantity: number }[];
}

const SYSTEM = 'system';

function view(
  reservation: ReservationRow,
  lines: { variantId: string; sku: string; quantity: number }[],
): ReservationView {
  return {
    id: reservation.id,
    orderId: reservation.orderId,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    lines: [...lines].sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

/**
 * Reservation lifecycle for checkout:
 *   reserve (order created) → confirm (payment succeeded: stock decremented)
 *                           → release (payment failed / cancelled) | expire (TTL)
 * Every transition is idempotent so retried calls and redelivered events are safe.
 */
@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async reserve(
    orderId: string,
    requested: readonly Line[],
    ttlSeconds?: number,
  ): Promise<{ reservation: ReservationView; created: boolean }> {
    const lines = normalizeLines(requested);
    const existing = await this.findByOrder(orderId);
    if (existing) return { reservation: this.assertSameRequest(existing, lines), created: false };

    try {
      const reservation = await this.db.transaction(async (tx) => {
        const items = await this.lockItems(
          tx,
          lines.map((line) => line.variantId),
        );
        this.assertAvailable(lines, items);

        const expiresAt = new Date(
          Date.now() + (ttlSeconds ?? this.config.RESERVATION_TTL_SECONDS) * 1000,
        );
        const [row] = await tx
          .insert(inventoryReservations)
          .values({ orderId, expiresAt })
          .returning();
        if (!row) throw new Error('reservation insert returned no row');
        const reservedLines = lines.map((line) => ({
          ...line,
          sku: items.get(line.variantId)?.sku ?? '',
        }));
        await tx
          .insert(reservationItems)
          .values(reservedLines.map((line) => ({ ...line, reservationId: row.id })));
        for (const line of reservedLines) {
          await applyStockChange(tx, line.variantId, {
            type: 'RESERVED',
            onHandDelta: 0,
            reservedDelta: line.quantity,
            actor: SYSTEM,
            reservationId: row.id,
            orderId,
          });
        }
        await enqueueEvent(
          tx,
          InventoryReservedV1,
          {
            reservationId: row.id,
            orderId,
            lines: reservedLines,
            expiresAt: expiresAt.toISOString(),
          },
          { producer: SERVICE_NAME, aggregateId: orderId },
        );
        return view(row, reservedLines);
      });
      return { reservation, created: true };
    } catch (error) {
      // A concurrent retry for the same order won the race: return its reservation.
      if (isUniqueViolation(error)) {
        const winner = await this.findByOrder(orderId);
        if (winner) return { reservation: this.assertSameRequest(winner, lines), created: false };
      }
      throw error;
    }
  }

  /**
   * Payment succeeded: turn held units into sold units. If the reservation had
   * already expired, try to sell from available stock; if that is gone too the
   * caller must refund (the only way to avoid overselling after a late payment).
   */
  async confirm(reservationId: string): Promise<ReservationView> {
    return this.db.transaction(async (tx) => {
      const { reservation, lines } = await this.lockReservation(tx, reservationId);
      if (reservation.status === 'CONFIRMED') return view(reservation, lines);

      const late = reservation.status !== 'ACTIVE';
      const items = await this.lockItems(
        tx,
        lines.map((line) => line.variantId),
      );
      if (late) this.assertAvailable(lines, items);

      const remaining: { variantId: string; onHand: number }[] = [];
      for (const line of lines) {
        const row = await applyStockChange(tx, line.variantId, {
          type: 'SOLD',
          onHandDelta: -line.quantity,
          reservedDelta: late ? 0 : -line.quantity,
          actor: SYSTEM,
          reason: late ? 'late_confirmation' : null,
          reservationId,
          orderId: reservation.orderId,
        });
        remaining.push({ variantId: line.variantId, onHand: row.onHand });
      }
      const [updated] = await tx
        .update(inventoryReservations)
        .set({ status: 'CONFIRMED', confirmedAt: new Date() })
        .where(eq(inventoryReservations.id, reservationId))
        .returning();
      await enqueueEvent(
        tx,
        InventoryDecrementedV1,
        { reservationId, orderId: reservation.orderId, lines, remaining },
        { producer: SERVICE_NAME, aggregateId: reservation.orderId },
      );
      if (late)
        this.logger.warn(
          `late confirmation of ${reservation.status} reservation ${reservationId} succeeded`,
        );
      return view(updated ?? reservation, lines);
    });
  }

  async release(reservationId: string, reason: ReleaseReason): Promise<ReservationView> {
    return this.db.transaction(async (tx) => {
      const { reservation, lines } = await this.lockReservation(tx, reservationId);
      if (reservation.status === 'RELEASED' || reservation.status === 'EXPIRED')
        return view(reservation, lines);
      if (reservation.status === 'CONFIRMED') {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'This reservation was already sold; record a return instead',
        );
      }
      return view(await this.releaseLocked(tx, reservation, lines, reason), lines);
    });
  }

  /**
   * Returns expired holds to available stock. FOR UPDATE SKIP LOCKED lets several
   * replicas sweep at once without blocking each other or releasing twice.
   */
  async expireDue(limit = this.config.EXPIRY_BATCH_SIZE, now = new Date()): Promise<number> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.status, 'ACTIVE'),
            lte(inventoryReservations.expiresAt, now),
          ),
        )
        .orderBy(asc(inventoryReservations.expiresAt))
        .limit(limit)
        .for('update', { skipLocked: true });
      const batch = [];
      for (const reservation of due)
        batch.push({ reservation, lines: await this.linesOf(tx, reservation.id) });
      // Lock every affected item once, in global order, before touching any of them:
      // locking per reservation (B then A) could deadlock with a reserve locking A then B.
      await this.lockItems(tx, [
        ...new Set(batch.flatMap(({ lines }) => lines.map((line) => line.variantId))),
      ]);
      for (const { reservation, lines } of batch) {
        await this.releaseLocked(tx, reservation, lines, 'EXPIRED');
      }
      return due.length;
    });
  }

  async get(reservationId: string): Promise<ReservationView> {
    const [reservation] = await this.db
      .select()
      .from(inventoryReservations)
      .where(eq(inventoryReservations.id, reservationId));
    if (!reservation) throw new DomainError(ErrorCode.NOT_FOUND, 'Reservation not found');
    return view(reservation, await this.linesOf(this.db, reservation.id));
  }

  async list(
    status: ReservationRow['status'] | undefined,
    limit: number,
  ): Promise<ReservationView[]> {
    const rows = await this.db
      .select()
      .from(inventoryReservations)
      .where(status ? eq(inventoryReservations.status, status) : undefined)
      .orderBy(asc(inventoryReservations.expiresAt))
      .limit(limit);
    const lines = rows.length
      ? await this.db
          .select()
          .from(reservationItems)
          .where(
            inArray(
              reservationItems.reservationId,
              rows.map((r) => r.id),
            ),
          )
      : [];
    return rows.map((row) =>
      view(
        row,
        lines
          .filter((line) => line.reservationId === row.id)
          .map(({ variantId, sku, quantity }) => ({ variantId, sku, quantity })),
      ),
    );
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async releaseLocked(
    tx: Database,
    reservation: ReservationRow,
    lines: { variantId: string; sku: string; quantity: number }[],
    reason: ReleaseReason | 'EXPIRED',
  ): Promise<ReservationRow> {
    await this.lockItems(
      tx,
      lines.map((line) => line.variantId),
    );
    for (const line of lines) {
      await applyStockChange(tx, line.variantId, {
        type: reason === 'EXPIRED' ? 'EXPIRED' : 'RELEASED',
        onHandDelta: 0,
        reservedDelta: -line.quantity,
        actor: SYSTEM,
        reason: reason.toLowerCase(),
        reservationId: reservation.id,
        orderId: reservation.orderId,
      });
    }
    const [updated] = await tx
      .update(inventoryReservations)
      .set({
        status: reason === 'EXPIRED' ? 'EXPIRED' : 'RELEASED',
        releasedAt: new Date(),
        releaseReason: reason,
      })
      .where(eq(inventoryReservations.id, reservation.id))
      .returning();
    const ref = { reservationId: reservation.id, orderId: reservation.orderId, lines };
    if (reason === 'EXPIRED') {
      await enqueueEvent(tx, InventoryReservationExpiredV1, ref, {
        producer: SERVICE_NAME,
        aggregateId: reservation.orderId,
      });
    } else {
      await enqueueEvent(
        tx,
        InventoryReleasedV1,
        { ...ref, reason },
        { producer: SERVICE_NAME, aggregateId: reservation.orderId },
      );
    }
    return updated ?? reservation;
  }

  /** Locks inventory rows in variant-id order (deadlock-free) and returns them by id. */
  private async lockItems(tx: Database, variantIds: string[]): Promise<Map<string, InventoryRow>> {
    const rows = await tx
      .select()
      .from(inventoryItems)
      .where(inArray(inventoryItems.variantId, variantIds))
      .orderBy(asc(inventoryItems.variantId))
      .for('update');
    return new Map(rows.map((row) => [row.variantId, row]));
  }

  private assertAvailable(lines: readonly Line[], items: Map<string, InventoryRow>): void {
    const details: { path: string; message: string }[] = [];
    for (const line of lines) {
      const item = items.get(line.variantId);
      if (!item) {
        details.push({ path: line.variantId, message: 'Not stocked' });
        continue;
      }
      const available = availableOf(item);
      if (available < line.quantity) {
        details.push({
          path: item.sku,
          message: available === 0 ? 'Out of stock' : `Only ${available} left`,
        });
      }
    }
    if (details.length > 0) {
      throw new DomainError(
        ErrorCode.INSUFFICIENT_STOCK,
        'Some items are no longer available in that quantity',
        details,
      );
    }
  }

  private async lockReservation(tx: Database, reservationId: string) {
    const [reservation] = await tx
      .select()
      .from(inventoryReservations)
      .where(eq(inventoryReservations.id, reservationId))
      .for('update');
    if (!reservation) throw new DomainError(ErrorCode.NOT_FOUND, 'Reservation not found');
    return { reservation, lines: await this.linesOf(tx, reservationId) };
  }

  private async linesOf(tx: Database, reservationId: string) {
    const rows = await tx
      .select()
      .from(reservationItems)
      .where(eq(reservationItems.reservationId, reservationId));
    return rows
      .map(({ variantId, sku, quantity }) => ({ variantId, sku, quantity }))
      .sort((a, b) => (a.variantId < b.variantId ? -1 : 1));
  }

  private async findByOrder(orderId: string): Promise<ReservationView | null> {
    const [row] = await this.db
      .select()
      .from(inventoryReservations)
      .where(eq(inventoryReservations.orderId, orderId));
    return row ? view(row, await this.linesOf(this.db, row.id)) : null;
  }

  private assertSameRequest(existing: ReservationView, lines: readonly Line[]): ReservationView {
    if (!sameLines(existing.lines, lines)) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'This order already has a reservation with different items',
      );
    }
    return existing;
  }
}
