import { enqueueEvent } from '@market/db';
import { OrderCancelledV1, OrderDeliveredV1, OrderPaidV1, OrderShippedV1 } from '@market/events';
import {
  BACK_OFFICE_ROLES,
  DomainError,
  ErrorCode,
  hasAnyRole,
  money,
  paginate,
  toOffset,
  type CancelReason,
  type Currency,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type Paginated,
  type PaginationQuery,
  type Role,
} from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, ilike, notInArray, or, type SQL } from 'drizzle-orm';
import { CART, INVENTORY, type CartGateway, type InventoryGateway } from '../clients/clients.js';
import { SERVICE_NAME } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { orders, type OrderRow } from '../db/schema.js';
import { sha256 } from './checkout.service.js';
import { loadHistory, loadItems, lockOrder, note, transition } from './order-store.js';
import { toOrder, toSummary } from './order-view.js';
import { assertTransition, isCustomerVisible } from './status.js';

export interface Viewer {
  userId: string | null;
  roles: Role[];
  /** Guest order access token (x-order-token). */
  orderToken: string | null;
  /** Visitor cart token (cse_cart cookie) of a guest. */
  cartToken: string | null;
}

export type PaymentOutcome = 'PAID' | 'ALREADY_PAID' | 'REFUND_REQUIRED';

const INTERNAL_STATUSES: OrderStatus[] = ['PENDING', 'FAILED'];
const ACTOR_SYSTEM = 'system';
const ACTOR_PAYMENTS = 'payment-service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CART) private readonly cart: CartGateway,
    @Inject(INVENTORY) private readonly inventory: InventoryGateway,
  ) {}

  // ── queries ────────────────────────────────────────────────────────────────

  /** 404 (not 403) for orders the viewer may not see, so order ids cannot be probed. */
  async getForViewer(orderId: string, viewer: Viewer): Promise<Order> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!row || !this.canView(row, viewer)) {
      throw new DomainError(ErrorCode.ORDER_NOT_FOUND, 'Order not found');
    }
    return this.view(row);
  }

  async listForUser(userId: string, query: PaginationQuery): Promise<Paginated<OrderSummary>> {
    return this.list(
      and(eq(orders.userId, userId), notInArray(orders.status, INTERNAL_STATUSES)),
      query,
    );
  }

  /** Back office: every order, newest first, optionally by status or number/email search. */
  async listAll(
    filters: { status?: OrderStatus; q?: string },
    query: PaginationQuery,
  ): Promise<Paginated<OrderSummary>> {
    const conditions: SQL[] = [];
    if (filters.status) conditions.push(eq(orders.status, filters.status));
    if (filters.q) {
      const pattern = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const match = or(ilike(orders.number, pattern), ilike(orders.email, pattern));
      if (match) conditions.push(match);
    }
    return this.list(conditions.length > 0 ? and(...conditions) : undefined, query);
  }

  async get(orderId: string): Promise<Order> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!row) throw new DomainError(ErrorCode.ORDER_NOT_FOUND, 'Order not found');
    return this.view(row);
  }

  // ── cancellation ───────────────────────────────────────────────────────────

  /** Customer cancellation: only before payment. */
  async cancelByCustomer(orderId: string, viewer: Viewer): Promise<Order> {
    await this.getForViewer(orderId, viewer);
    return this.cancel(orderId, 'CUSTOMER_REQUEST', viewer.userId ?? 'customer');
  }

  /**
   * Cancels an unpaid order and gives back its stock and discount use. The order
   * row stays locked while the (idempotent) releases run, so a payment confirmation
   * for the same order waits and then sees CANCELLED instead of racing it.
   */
  async cancel(orderId: string, reason: CancelReason, actor: string): Promise<Order> {
    const row = await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status === 'CANCELLED') return order;
      if (order.status !== 'PENDING_PAYMENT') {
        throw new DomainError(
          ErrorCode.INVALID_ORDER_STATE,
          order.status === 'PAID' || order.status === 'PROCESSING'
            ? 'This order is already paid; request a refund instead'
            : 'This order can no longer be cancelled',
        );
      }
      await this.releaseHolds(order, 'ORDER_CANCELLED');
      const cancelled = await transition(tx, order, 'CANCELLED', {
        actor,
        note: reasonNote(reason),
        changes: { cancelledAt: new Date(), cancelReason: reason },
      });
      await this.emitCancelled(tx, cancelled, false);
      return cancelled;
    });
    return this.view(row);
  }

  // ── payments (payment-service, Phase 9) ────────────────────────────────────

  /**
   * Payment captured. Idempotent (webhooks are delivered at least once). Confirms
   * the stock hold; if the hold expired and the stock is gone, or the order was
   * already cancelled, the order is flagged for a refund instead of overselling.
   */
  async paymentSucceeded(
    orderId: string,
    payment: { paymentId: string; amount: number; currency: string },
  ): Promise<{ order: Order; outcome: PaymentOutcome }> {
    const result = await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.paymentId === payment.paymentId) {
        // Webhook retry: answer as the first delivery did.
        return {
          row: order,
          outcome: order.paidAt ? ('ALREADY_PAID' as const) : ('REFUND_REQUIRED' as const),
        };
      }
      if (order.total !== payment.amount || order.currency !== payment.currency) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `Payment amount ${String(payment.amount)} ${payment.currency} does not match the order total`,
        );
      }
      if (order.status !== 'PENDING_PAYMENT') {
        // Late payment for a cancelled/expired order, or a second payment for a paid one.
        await tx
          .update(orders)
          .set({
            refundRequired: true,
            paymentId: order.paymentId ?? payment.paymentId,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
        await note(
          tx,
          order,
          `Payment ${payment.paymentId} received while ${order.status.toLowerCase()}; refund required`,
          ACTOR_PAYMENTS,
        );
        if (order.status === 'CANCELLED') await this.emitCancelled(tx, order, true);
        return {
          row: { ...order, refundRequired: true, paymentId: order.paymentId ?? payment.paymentId },
          outcome: 'REFUND_REQUIRED' as const,
        };
      }

      if (order.reservationId) {
        try {
          await this.inventory.confirm(order.reservationId);
        } catch (error) {
          if (!(error instanceof DomainError) || error.code !== ErrorCode.INSUFFICIENT_STOCK)
            throw error;
          // Paid after the hold expired and someone else bought the last units.
          await this.cart.release(order.id);
          const cancelled = await transition(tx, order, 'CANCELLED', {
            actor: ACTOR_PAYMENTS,
            note: 'Paid after the stock hold expired and the items sold out; refund required',
            changes: {
              cancelledAt: new Date(),
              cancelReason: 'OUT_OF_STOCK',
              refundRequired: true,
              paymentId: payment.paymentId,
            },
          });
          await this.emitCancelled(tx, cancelled, true);
          return { row: cancelled, outcome: 'REFUND_REQUIRED' as const };
        }
      }
      const paid = await transition(tx, order, 'PAID', {
        actor: ACTOR_PAYMENTS,
        changes: { paidAt: new Date(), paymentId: payment.paymentId },
      });
      const currency = paid.currency as Currency;
      await enqueueEvent(
        tx,
        OrderPaidV1,
        {
          orderId,
          orderNumber: paid.number,
          paymentId: payment.paymentId,
          reservationId: paid.reservationId,
          total: money(paid.total, currency),
          paidAt: (paid.paidAt ?? new Date()).toISOString(),
        },
        { producer: SERVICE_NAME, aggregateId: orderId },
      );
      return { row: paid, outcome: 'PAID' as const };
    });

    if (result.outcome === 'PAID' && result.row.cartId) {
      // Best effort: a cart left full is an annoyance, not an error (Phase 10 moves this to OrderPaid).
      await this.cart.clear(result.row.cartId).catch((error: unknown) => {
        this.logger.warn(`cart ${result.row.cartId ?? ''} not cleared: ${String(error)}`);
      });
    }
    if (result.outcome === 'REFUND_REQUIRED') {
      this.logger.warn(
        `order ${result.row.number}: payment received but cannot be fulfilled; refund required`,
      );
    }
    return { order: await this.view(result.row), outcome: result.outcome };
  }

  /** A payment attempt failed. The shopper may retry until the payment window closes. */
  async paymentFailed(orderId: string, message: string | null): Promise<Order> {
    const row = await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status === 'PENDING_PAYMENT') {
        await note(
          tx,
          order,
          `Payment attempt failed${message ? `: ${message}` : ''}`,
          ACTOR_PAYMENTS,
        );
      }
      return order;
    });
    return this.view(row);
  }

  /**
   * A refund settled at Stripe. A full refund of a live order ends it as REFUNDED;
   * for a cancelled order flagged `refundRequired` it settles the flag. Partial
   * refunds are recorded on the timeline only. Idempotent.
   */
  async refunded(
    orderId: string,
    refund: { paymentId: string; amount: number; full: boolean },
  ): Promise<Order> {
    const row = await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status === 'REFUNDED') return order;
      const amount = `${(refund.amount / 100).toFixed(2)} ${order.currency}`;
      const text = refund.full
        ? `Refunded ${amount}; fully refunded`
        : `Partially refunded ${amount}`;
      if (order.status === 'CANCELLED') {
        if (!order.refundRequired) return order;
        await note(tx, order, text, ACTOR_PAYMENTS);
        if (!refund.full) return order;
        const [settled] = await tx
          .update(orders)
          .set({ refundRequired: false, updatedAt: new Date() })
          .where(eq(orders.id, orderId))
          .returning();
        return settled ?? order;
      }
      if (!refund.full) {
        await note(tx, order, text, ACTOR_PAYMENTS);
        return order;
      }
      return transition(tx, order, 'REFUNDED', { actor: ACTOR_PAYMENTS, note: text });
    });
    return this.view(row);
  }

  // ── fulfilment (back office) ───────────────────────────────────────────────

  async advance(
    orderId: string,
    to: 'PROCESSING' | 'SHIPPED' | 'DELIVERED',
    input: {
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string | null;
      note?: string | null;
    },
    actor: string,
  ): Promise<Order> {
    const row = await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status === to) return order;
      assertTransition(order.status, to);
      const now = new Date();
      if (to === 'SHIPPED') {
        if (!input.carrier || !input.trackingNumber) {
          throw new DomainError(
            ErrorCode.VALIDATION_FAILED,
            'Carrier and tracking number are required',
            [{ path: 'trackingNumber', message: 'Required when marking an order shipped' }],
          );
        }
        const shipped = await transition(tx, order, 'SHIPPED', {
          actor,
          note: input.note ?? null,
          changes: {
            carrier: input.carrier,
            trackingNumber: input.trackingNumber,
            trackingUrl: input.trackingUrl ?? null,
            shippedAt: now,
          },
        });
        await enqueueEvent(
          tx,
          OrderShippedV1,
          {
            orderId,
            carrier: input.carrier,
            trackingNumber: input.trackingNumber,
            trackingUrl: input.trackingUrl ?? null,
            shippedAt: now.toISOString(),
          },
          { producer: SERVICE_NAME, aggregateId: orderId },
        );
        return shipped;
      }
      if (to === 'DELIVERED') {
        const delivered = await transition(tx, order, 'DELIVERED', {
          actor,
          note: input.note ?? null,
          changes: { deliveredAt: now },
        });
        await enqueueEvent(
          tx,
          OrderDeliveredV1,
          { orderId, deliveredAt: now.toISOString() },
          { producer: SERVICE_NAME, aggregateId: orderId },
        );
        return delivered;
      }
      return transition(tx, order, 'PROCESSING', { actor, note: input.note ?? null });
    });
    return this.view(row);
  }

  // ── sweeping ───────────────────────────────────────────────────────────────

  /** Cancels unpaid orders whose payment window (plus grace) has passed. */
  async expire(orderIds: string[]): Promise<number> {
    let expired = 0;
    for (const orderId of orderIds) {
      try {
        const order = await this.cancel(orderId, 'PAYMENT_TIMEOUT', ACTOR_SYSTEM);
        if (order.cancelReason === 'PAYMENT_TIMEOUT') expired += 1;
      } catch (error) {
        // Paid meanwhile (INVALID_ORDER_STATE) is expected; anything else is retried next sweep.
        if (!(error instanceof DomainError && error.code === ErrorCode.INVALID_ORDER_STATE)) {
          this.logger.warn(`could not expire order ${orderId}: ${String(error)}`);
        }
      }
    }
    return expired;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private canView(row: OrderRow, viewer: Viewer): boolean {
    if (hasAnyRole(viewer.roles, BACK_OFFICE_ROLES)) return true;
    if (!isCustomerVisible(row.status)) return false;
    if (viewer.userId && row.userId === viewer.userId) return true;
    if (
      viewer.orderToken &&
      row.accessTokenHash &&
      sha256(viewer.orderToken) === row.accessTokenHash
    )
      return true;
    return Boolean(
      viewer.cartToken && row.guestCartHash && sha256(viewer.cartToken) === row.guestCartHash,
    );
  }

  private async releaseHolds(order: OrderRow, reason: 'ORDER_CANCELLED' | 'PAYMENT_FAILED') {
    if (order.reservationId) await this.inventory.release(order.reservationId, reason);
    if (order.couponCode) await this.cart.release(order.id);
  }

  private async emitCancelled(tx: Database, order: OrderRow, refundRequired: boolean) {
    await enqueueEvent(
      tx,
      OrderCancelledV1,
      {
        orderId: order.id,
        orderNumber: order.number,
        reservationId: order.reservationId,
        reason: order.cancelReason ?? 'ADMIN',
        refundRequired,
      },
      { producer: SERVICE_NAME, aggregateId: order.id },
    );
  }

  private async list(
    where: SQL | undefined,
    query: PaginationQuery,
  ): Promise<Paginated<OrderSummary>> {
    const { offset, limit } = toOffset(query);
    const rows = await this.db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(orders)
      .where(where);
    const items = await loadItems(
      this.db,
      rows.map((row) => row.id),
    );
    return paginate(
      rows.map((row) => toSummary(row, items.get(row.id) ?? [])),
      total,
      query,
    );
  }

  private async view(row: OrderRow): Promise<Order> {
    const items = (await loadItems(this.db, [row.id])).get(row.id) ?? [];
    return toOrder(row, items, await loadHistory(this.db, row.id));
  }
}

function reasonNote(reason: CancelReason): string {
  switch (reason) {
    case 'CUSTOMER_REQUEST':
      return 'Cancelled by the customer';
    case 'PAYMENT_TIMEOUT':
      return 'Not paid in time';
    case 'PAYMENT_FAILED':
      return 'Payment failed';
    case 'OUT_OF_STOCK':
      return 'Out of stock';
    case 'ADMIN':
      return 'Cancelled by the store';
  }
}
