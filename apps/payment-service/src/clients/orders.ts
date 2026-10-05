import { createServiceClient } from '@market/nest-common';
import { OrderSchema, type Order, type Role } from '@market/types';
import { z } from 'zod';

export interface Viewer {
  userId: string | null;
  roles: Role[];
  orderToken: string | null;
  cartToken: string | null;
}

export type PaymentOutcome = 'PAID' | 'ALREADY_PAID' | 'REFUND_REQUIRED';

/** order-service: the authoritative order (amount to charge) and its payment status. */
export interface OrdersGateway {
  /** The order if this viewer may see it; ORDER_NOT_FOUND otherwise. */
  accessible(orderId: string, viewer: Viewer): Promise<Order>;
  paymentSucceeded(
    orderId: string,
    payment: { paymentId: string; amount: number; currency: string },
  ): Promise<{ outcome: PaymentOutcome }>;
  paymentFailed(orderId: string, message: string | null): Promise<void>;
  refunded(
    orderId: string,
    refund: { paymentId: string; amount: number; full: boolean },
  ): Promise<void>;
}

export const ORDERS = Symbol('ORDERS');

export class HttpOrdersGateway implements OrdersGateway {
  private readonly call;

  constructor(baseUrl: string) {
    this.call = createServiceClient({ baseUrl, service: 'order-service', timeoutMs: 10_000 });
  }

  accessible(orderId: string, viewer: Viewer): Promise<Order> {
    return this.call(`/internal/orders/${orderId}/access`, {
      method: 'POST',
      body: viewer,
      schema: OrderSchema,
    });
  }

  paymentSucceeded(
    orderId: string,
    payment: { paymentId: string; amount: number; currency: string },
  ): Promise<{ outcome: PaymentOutcome }> {
    return this.call(`/internal/orders/${orderId}/payment-succeeded`, {
      method: 'POST',
      body: payment,
      schema: z.object({ outcome: z.enum(['PAID', 'ALREADY_PAID', 'REFUND_REQUIRED']) }),
    });
  }

  async paymentFailed(orderId: string, message: string | null): Promise<void> {
    await this.call(`/internal/orders/${orderId}/payment-failed`, {
      method: 'POST',
      body: { message },
      schema: z.unknown(),
    });
  }

  async refunded(
    orderId: string,
    refund: { paymentId: string; amount: number; full: boolean },
  ): Promise<void> {
    await this.call(`/internal/orders/${orderId}/refunded`, {
      method: 'POST',
      body: refund,
      schema: z.unknown(),
    });
  }
}
