import type {
  EventDefinition,
  EventEnvelope,
  NotificationRequestedV1,
  OrderCancelledV1,
  OrderCreatedV1,
  OrderDeliveredV1,
  OrderPaidV1,
  OrderShippedV1,
  PaymentFailedV1,
  PaymentRefundedV1,
} from '@market/events';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/database.js';
import { orderContacts, type OrderContactRow } from '../db/schema.js';
import type { NotificationService } from '../notifications/notification.service.js';

type Event<D extends EventDefinition> = EventEnvelope<D>;

/**
 * Turns domain events into notifications. All handlers only write to this
 * service's database, inside the consumer's inbox transaction: each event
 * queues its email exactly once, and the dispatcher sends it.
 */
export class OrderNotifications {
  constructor(private readonly notifications: NotificationService) {}

  /** Explicit requests from other services (auth links). */
  async onNotificationRequested(tx: Database, event: Event<typeof NotificationRequestedV1>) {
    const { payload } = event;
    await this.notifications.enqueue(tx, {
      key: payload.notificationKey,
      template: payload.template,
      recipient: payload.recipient,
      data: payload.data,
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
    });
  }

  /** Remembers what later order emails need: OrderPaid/Shipped carry only ids. */
  async onOrderCreated(tx: Database, event: Event<typeof OrderCreatedV1>) {
    const p = event.payload;
    await tx
      .insert(orderContacts)
      .values({
        orderId: p.orderId,
        orderNumber: p.orderNumber,
        userId: p.userId,
        email: p.email,
        summary: {
          lines: p.lines.map((line) => ({
            name: line.name,
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
          subtotal: p.subtotal,
          discount: p.discount,
          shipping: p.shipping,
          tax: p.tax,
          total: p.total,
          couponCode: p.couponCode,
        },
      })
      .onConflictDoNothing();
  }

  async onOrderPaid(tx: Database, event: Event<typeof OrderPaidV1>) {
    const order = await this.contact(tx, event.payload.orderId);
    await this.send(tx, event, order, 'ORDER_CONFIRMATION', `order-confirmation:${order.orderId}`, {
      summary: order.summary,
      paidAt: event.payload.paidAt,
    });
  }

  async onOrderShipped(tx: Database, event: Event<typeof OrderShippedV1>) {
    const order = await this.contact(tx, event.payload.orderId);
    await this.send(tx, event, order, 'ORDER_SHIPPED', `order-shipped:${order.orderId}`, {
      carrier: event.payload.carrier,
      trackingNumber: event.payload.trackingNumber,
      trackingUrl: event.payload.trackingUrl,
    });
  }

  async onOrderDelivered(tx: Database, event: Event<typeof OrderDeliveredV1>) {
    const order = await this.contact(tx, event.payload.orderId);
    await this.send(tx, event, order, 'ORDER_DELIVERED', `order-delivered:${order.orderId}`, {});
  }

  /**
   * Cancellations the customer did not just see happen. Unpaid checkouts that
   * timed out are not worth an email; failed payments have their own.
   */
  async onOrderCancelled(tx: Database, event: Event<typeof OrderCancelledV1>) {
    const { reason, refundRequired } = event.payload;
    if (reason !== 'CUSTOMER_REQUEST' && reason !== 'ADMIN' && reason !== 'OUT_OF_STOCK') return;
    const order = await this.contact(tx, event.payload.orderId);
    await this.send(tx, event, order, 'ORDER_CANCELLED', `order-cancelled:${order.orderId}`, {
      reason,
      refundRequired,
    });
  }

  /** At most one per order: retrying a declined card should not flood the inbox. */
  async onPaymentFailed(tx: Database, event: Event<typeof PaymentFailedV1>) {
    const order = await this.contact(tx, event.payload.orderId);
    await this.send(tx, event, order, 'PAYMENT_FAILED', `payment-failed:${order.orderId}`, {
      failureMessage: event.payload.failureMessage,
    });
  }

  async onPaymentRefunded(tx: Database, event: Event<typeof PaymentRefundedV1>) {
    const p = event.payload;
    const order = await this.contact(tx, p.orderId);
    await this.send(tx, event, order, 'REFUND_ISSUED', `refund:${p.refundId}`, {
      refunded: p.refunded,
      totalRefunded: p.totalRefunded,
      isFullRefund: p.isFullRefund,
    });
  }

  private async send(
    tx: Database,
    event: Pick<EventEnvelope, 'correlationId' | 'occurredAt'>,
    order: OrderContactRow,
    template: Parameters<NotificationService['enqueue']>[1]['template'],
    key: string,
    data: Record<string, unknown>,
  ) {
    await this.notifications.enqueue(tx, {
      key,
      template,
      recipient: { userId: order.userId, email: order.email },
      data: { orderId: order.orderId, orderNumber: order.orderNumber, ...data },
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
    });
  }

  /**
   * OrderCreated always precedes the other events of an order (same partition
   * for order events; payments start after checkout). If it has not been
   * projected yet, failing makes the consumer retry, then dead-letter.
   */
  private async contact(tx: Database, orderId: string): Promise<OrderContactRow> {
    const [row] = await tx.select().from(orderContacts).where(eq(orderContacts.orderId, orderId));
    if (!row) throw new Error(`Order ${orderId} is not known yet (OrderCreated not processed)`);
    return row;
  }
}
