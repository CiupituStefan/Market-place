import { createServiceClient } from '@market/nest-common';
import { CartSchema, type Cart } from '@market/types';
import { z } from 'zod';

export interface CartIdentity {
  userId: string | null;
  guestToken: string | null;
}

export interface Redemption {
  orderId: string;
  code: string;
}

/** cart-service: the authoritative priced cart and discount-code claims. */
export interface CartGateway {
  priced(identity: CartIdentity): Promise<Cart>;
  redeem(input: {
    code: string;
    orderId: string;
    userId: string | null;
    subtotal: number;
  }): Promise<Redemption>;
  /** Idempotent: releasing an order without a claim is a no-op. */
  release(orderId: string): Promise<void>;
}

export interface Reservation {
  id: string;
  status: 'ACTIVE' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
}

/** inventory-service: stock holds that prevent overselling. */
export interface InventoryGateway {
  /** Idempotent per order id. */
  reserve(
    orderId: string,
    lines: { variantId: string; quantity: number }[],
    ttlSeconds: number,
  ): Promise<Reservation>;
  /** Payment captured: held units become sold. Fails with INSUFFICIENT_STOCK after a late payment with no stock left. */
  confirm(reservationId: string): Promise<Reservation>;
  /** Idempotent: an expired or released reservation stays as it is. */
  release(reservationId: string, reason: 'PAYMENT_FAILED' | 'ORDER_CANCELLED'): Promise<void>;
}

export const CART = Symbol('CART');
export const INVENTORY = Symbol('INVENTORY');

const ReservationSchema = z.object({
  id: z.uuid(),
  status: z.enum(['ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED']),
  expiresAt: z.string(),
});

export class HttpCartGateway implements CartGateway {
  private readonly call;

  constructor(baseUrl: string) {
    this.call = createServiceClient({ baseUrl, service: 'cart-service', timeoutMs: 5_000 });
  }

  priced(identity: CartIdentity): Promise<Cart> {
    return this.call('/internal/carts/priced', {
      method: 'POST',
      body: identity,
      schema: CartSchema,
    });
  }

  redeem(input: Parameters<CartGateway['redeem']>[0]): Promise<Redemption> {
    return this.call('/internal/discounts/redeem', {
      method: 'POST',
      body: input,
      schema: z.object({ orderId: z.uuid(), code: z.string() }),
    });
  }

  async release(orderId: string): Promise<void> {
    await this.call('/internal/discounts/release', {
      method: 'POST',
      body: { orderId },
      schema: z.unknown(),
    });
  }
}

export class HttpInventoryGateway implements InventoryGateway {
  private readonly call;

  constructor(baseUrl: string) {
    this.call = createServiceClient({ baseUrl, service: 'inventory-service', timeoutMs: 5_000 });
  }

  reserve(
    orderId: string,
    lines: { variantId: string; quantity: number }[],
    ttlSeconds: number,
  ): Promise<Reservation> {
    return this.call('/internal/reservations', {
      method: 'POST',
      body: { orderId, lines, ttlSeconds },
      schema: ReservationSchema,
    });
  }

  confirm(reservationId: string): Promise<Reservation> {
    return this.call(`/internal/reservations/${reservationId}/confirm`, {
      method: 'POST',
      schema: ReservationSchema,
    });
  }

  async release(
    reservationId: string,
    reason: 'PAYMENT_FAILED' | 'ORDER_CANCELLED',
  ): Promise<void> {
    await this.call(`/internal/reservations/${reservationId}/release`, {
      method: 'POST',
      body: { reason },
      schema: z.unknown(),
    });
  }
}
