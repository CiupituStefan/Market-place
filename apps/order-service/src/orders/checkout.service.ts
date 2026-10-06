import { domainMetrics } from '@market/telemetry';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { enqueueEvent, isUniqueViolation } from '@market/db';
import { OrderCreatedV1 } from '@market/events';
import {
  CheckoutRequestSchema,
  DomainError,
  ErrorCode,
  money,
  type Cart,
  type Currency,
  type PlacedOrder,
} from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import {
  CART,
  INVENTORY,
  type CartGateway,
  type CartIdentity,
  type InventoryGateway,
  type Reservation,
} from '../clients/clients.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { idempotencyKeys, orderItems, orders, orderStatusHistory } from '../db/schema.js';
import { includedVat, VAT_RATES_BPS } from '../tax/vat.js';
import { loadHistory, loadItems, lockOrder, transition } from './order-store.js';
import { toOrder } from './order-view.js';

export type CheckoutInput = z.output<typeof CheckoutRequestSchema>;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Places orders. Checkout is a saga across three services, driven from here with
 * state persisted at every step so a crash can always be compensated:
 *
 *   1. claim the Idempotency-Key           (a retry returns the same order)
 *   2. read the priced cart from cart-service and check it is what the shopper saw
 *   3. insert the order as PENDING          (internal, invisible to the shopper)
 *   4. reserve stock in inventory-service   (idempotent per order id)
 *   5. claim the discount code              (idempotent per order id)
 *   6. PENDING → PENDING_PAYMENT + OrderCreated in the outbox, in one transaction
 *
 * A failure in 4–6 releases what was taken and marks the order FAILED; a crash
 * leaves a stale PENDING order that the sweeper compensates the same way.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CART) private readonly cart: CartGateway,
    @Inject(INVENTORY) private readonly inventory: InventoryGateway,
  ) {}

  async place(
    identity: CartIdentity,
    idempotencyKey: string,
    request: CheckoutInput,
  ): Promise<{ order: PlacedOrder; replayed: boolean }> {
    if (!identity.userId && !identity.guestToken) {
      throw new DomainError(ErrorCode.CART_EMPTY, 'Your cart is empty');
    }
    const scope = identity.userId
      ? `user:${identity.userId}`
      : `guest:${sha256(identity.guestToken ?? '')}`;
    const requestHash = sha256(JSON.stringify(request));

    const replay = await this.claim(scope, idempotencyKey, requestHash);
    if (replay) return { order: await this.replay(replay), replayed: true };

    let orderId: string;
    let cart: Cart;
    let accessToken: string | null;
    try {
      cart = await this.cart.priced(identity);
      this.assertCheckoutable(cart, request.expectedTotal);
      ({ orderId, accessToken } = await this.insertPending(
        identity,
        cart,
        request,
        scope,
        idempotencyKey,
      ));
    } catch (error) {
      await this.releaseClaim(scope, idempotencyKey);
      throw error;
    }

    let reservation: Reservation | null = null;
    try {
      const stockLines = cart.items.flatMap((item) =>
        item.kind === 'variant' && item.variantId
          ? [{ variantId: item.variantId, quantity: item.quantity }]
          : [],
      );
      if (stockLines.length > 0) {
        reservation = await this.inventory.reserve(
          orderId,
          stockLines,
          this.config.PAYMENT_WINDOW_SECONDS,
        );
      }
      if (cart.couponCode) {
        await this.cart.redeem({
          code: cart.couponCode,
          orderId,
          userId: identity.userId,
          subtotal: cart.subtotal.amount,
        });
      }
      await this.confirmPlaced(orderId, reservation);
    } catch (error) {
      await this.fail(orderId, reservation?.id ?? null, error);
      await this.releaseClaim(scope, idempotencyKey);
      throw error;
    }

    const order = await this.load(orderId);
    this.logger.log(`order ${order.number} placed (${order.items.length} lines)`);
    return { order: { ...order, accessToken }, replayed: false };
  }

  /**
   * Compensates a checkout that never finished (crash or timeout between steps):
   * releases the discount claim and marks the order FAILED. A reservation made
   * before the crash is unknown here and simply expires with its TTL.
   */
  async compensateStale(orderId: string): Promise<void> {
    await this.fail(orderId, null, new Error('checkout did not complete in time'));
  }

  // ── steps ──────────────────────────────────────────────────────────────────

  /** Returns the order id of an earlier identical request, or null when this request may proceed. */
  private async claim(scope: string, key: string, requestHash: string): Promise<string | null> {
    try {
      await this.db.insert(idempotencyKeys).values({ scope, key, requestHash });
      return null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const [existing] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
    // The first request failed and released its claim in between: ask for a retry.
    if (!existing) throw new DomainError(ErrorCode.CONFLICT, 'Please try placing your order again');
    if (existing.requestHash !== requestHash) {
      throw new DomainError(
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
        'This idempotency key was already used for a different order',
      );
    }
    if (!existing.orderId) {
      throw new DomainError(ErrorCode.CONFLICT, 'This order is already being placed');
    }
    return existing.orderId;
  }

  private async releaseClaim(scope: string, key: string): Promise<void> {
    await this.db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
      .catch((error: unknown) => {
        this.logger.error(`could not release idempotency key: ${String(error)}`);
      });
  }

  /**
   * The token is only ever returned by the first response (only its hash is stored).
   * A guest whose first response was lost still reaches the order through the
   * cart cookie that placed it.
   */
  private async replay(orderId: string): Promise<PlacedOrder> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (row?.status === 'PENDING') {
      throw new DomainError(ErrorCode.CONFLICT, 'This order is already being placed');
    }
    return { ...(await this.load(orderId)), accessToken: null };
  }

  private assertCheckoutable(cart: Cart, expectedTotal: number): void {
    if (!cart.id || cart.items.length === 0) {
      throw new DomainError(ErrorCode.CART_EMPTY, 'Your cart is empty');
    }
    if (!cart.canCheckout) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Some items in your cart are no longer available. Review your cart and try again.',
        cart.notices.map((notice) => ({ path: notice.itemId ?? 'cart', message: notice.message })),
      );
    }
    if (cart.total.amount !== expectedTotal) {
      throw new DomainError(
        ErrorCode.PRICE_CHANGED,
        'Your order total changed. Please review it before paying.',
        [{ path: 'expectedTotal', message: `Current total: ${String(cart.total.amount)}` }],
      );
    }
  }

  private async insertPending(
    identity: CartIdentity,
    cart: Cart,
    request: CheckoutInput,
    scope: string,
    idempotencyKey: string,
  ): Promise<{ orderId: string; accessToken: string | null }> {
    const orderId = randomUUID();
    const accessToken = identity.userId ? null : randomBytes(32).toString('base64url');
    const vatRateBps = VAT_RATES_BPS[request.shippingAddress.country];
    await this.db.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        status: 'PENDING',
        userId: identity.userId,
        email: request.email.toLowerCase(),
        accessTokenHash: accessToken ? sha256(accessToken) : null,
        guestCartHash: identity.guestToken ? sha256(identity.guestToken) : null,
        cartId: cart.id,
        currency: cart.total.currency,
        subtotal: cart.subtotal.amount,
        discount: cart.discount.amount,
        shipping: cart.shipping.amount,
        tax: includedVat(cart.total.amount, vatRateBps),
        vatRateBps,
        total: cart.total.amount,
        couponCode: cart.couponCode,
        shippingAddress: request.shippingAddress,
        billingAddress: request.billingAddress ?? request.shippingAddress,
        notes: request.notes,
      });
      await tx.insert(orderItems).values(
        cart.items.map((item, position) => ({
          orderId,
          position,
          kind: item.kind,
          variantId: item.variantId,
          configurator: item.configurator,
          configurationId: item.configurationId,
          selection: item.selection,
          productSlug: item.productSlug,
          sku: item.sku,
          name: item.name,
          optionsLabel: item.optionsLabel,
          preview: item.preview,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          unitPrice: item.unitPrice.amount,
          lineTotal: item.lineTotal.amount,
        })),
      );
      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: null,
        toStatus: 'PENDING',
        actor: identity.userId ?? 'customer',
      });
      await tx
        .update(idempotencyKeys)
        .set({ orderId })
        .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, idempotencyKey)));
    });
    return { orderId, accessToken };
  }

  private async confirmPlaced(orderId: string, reservation: Reservation | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      // The sweeper may have given up on this checkout meanwhile: transition() refuses FAILED → PENDING_PAYMENT.
      const paymentDueAt = reservation
        ? new Date(reservation.expiresAt)
        : new Date(Date.now() + this.config.PAYMENT_WINDOW_SECONDS * 1_000);
      const placed = await transition(tx, order, 'PENDING_PAYMENT', {
        actor: order.userId ?? 'customer',
        changes: { reservationId: reservation?.id ?? null, paymentDueAt },
      });
      const items = (await loadItems(tx, [orderId])).get(orderId) ?? [];
      const currency = placed.currency as Currency;
      await enqueueEvent(
        tx,
        OrderCreatedV1,
        {
          orderId,
          orderNumber: placed.number,
          userId: placed.userId,
          email: placed.email,
          lines: items.map((item) => ({
            kind: item.kind,
            variantId: item.variantId,
            configurationId: item.configurationId,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: money(item.unitPrice, currency),
          })),
          shippingCountry: placed.shippingAddress.country,
          couponCode: placed.couponCode,
          subtotal: money(placed.subtotal, currency),
          discount: money(placed.discount, currency),
          shipping: money(placed.shipping, currency),
          tax: money(placed.tax, currency),
          total: money(placed.total, currency),
        },
        { producer: SERVICE_NAME, aggregateId: orderId },
      );
    });
    domainMetrics.orderCreated();
  }

  /** Undo what a checkout took and mark it FAILED. Every step is idempotent. */
  private async fail(orderId: string, reservationId: string | null, cause: unknown): Promise<void> {
    const reason = cause instanceof DomainError ? cause.code : 'UNEXPECTED';
    domainMetrics.checkoutFailed(reason);
    if (reservationId) {
      await this.inventory.release(reservationId, 'ORDER_CANCELLED').catch((error: unknown) => {
        this.logger.warn(
          `reservation ${reservationId} not released (${String(error)}); it will expire`,
        );
      });
    }
    await this.cart.release(orderId).catch((error: unknown) => {
      this.logger.error(`discount claim of order ${orderId} not released: ${String(error)}`);
    });
    await this.db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status !== 'PENDING') return;
      await transition(tx, order, 'FAILED', {
        actor: 'system',
        note: `Checkout failed: ${reason}`,
        changes: { failureReason: reason },
      });
    });
    if (!(cause instanceof DomainError) || cause.status >= 500) {
      this.logger.error(`checkout of order ${orderId} failed: ${String(cause)}`);
    }
  }

  private async load(orderId: string) {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!row) throw new DomainError(ErrorCode.ORDER_NOT_FOUND, 'Order not found');
    const items = (await loadItems(this.db, [orderId])).get(orderId) ?? [];
    return toOrder(row, items, await loadHistory(this.db, orderId));
  }
}
