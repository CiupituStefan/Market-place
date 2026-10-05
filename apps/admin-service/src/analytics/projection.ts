import type {
  EventDefinition,
  EventEnvelope,
  OrderCancelledV1,
  OrderCreatedV1,
  OrderPaidV1,
  PaymentRefundedV1,
} from '@market/events';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/database.js';
import { salesLines, salesOrders, salesRefunds } from '../db/schema.js';

type Event<D extends EventDefinition> = EventEnvelope<D>;

/**
 * Builds the sales read model from order and payment events. Every handler runs
 * in the consumer's inbox transaction (exactly-once), and is written so that a
 * replay of the same facts leaves the same rows.
 */
export class SalesProjection {
  async onOrderCreated(tx: Database, event: Event<typeof OrderCreatedV1>): Promise<void> {
    const p = event.payload;
    const [inserted] = await tx
      .insert(salesOrders)
      .values({
        orderId: p.orderId,
        orderNumber: p.orderNumber,
        userId: p.userId,
        email: p.email.toLowerCase(),
        currency: p.total.currency,
        subtotal: p.subtotal.amount,
        discount: p.discount.amount,
        shipping: p.shipping.amount,
        tax: p.tax.amount,
        total: p.total.amount,
        couponCode: p.couponCode,
        shippingCountry: p.shippingCountry,
        createdAt: new Date(event.occurredAt),
      })
      .onConflictDoNothing()
      .returning({ orderId: salesOrders.orderId });
    if (!inserted) return;
    await tx.insert(salesLines).values(
      p.lines.map((line, i) => ({
        orderId: p.orderId,
        lineNo: i + 1,
        kind: line.kind,
        variantId: line.variantId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice.amount,
      })),
    );
  }

  async onOrderPaid(tx: Database, event: Event<typeof OrderPaidV1>): Promise<void> {
    const updated = await tx
      .update(salesOrders)
      .set({
        // A payment that lands after cancellation is still a sale (refunded later).
        status: sql`CASE WHEN ${salesOrders.status} = 'PENDING_PAYMENT' THEN 'PAID'::sales_status ELSE ${salesOrders.status} END`,
        wasPaid: true,
        paidAt: sql`COALESCE(${salesOrders.paidAt}, ${new Date(event.payload.paidAt)})`,
      })
      .where(eq(salesOrders.orderId, event.payload.orderId))
      .returning({ orderId: salesOrders.orderId });
    // Same partition as OrderCreated, so this only happens on a broken stream: retry, then DLQ.
    if (updated.length === 0) throw new Error(`Order ${event.payload.orderId} is not known yet`);
  }

  async onOrderCancelled(tx: Database, event: Event<typeof OrderCancelledV1>): Promise<void> {
    await tx
      .update(salesOrders)
      .set({
        status: 'CANCELLED',
        cancelledAt: sql`COALESCE(${salesOrders.cancelledAt}, ${new Date(event.occurredAt)})`,
        cancelReason: event.payload.reason,
      })
      .where(eq(salesOrders.orderId, event.payload.orderId));
  }

  async onPaymentRefunded(tx: Database, event: Event<typeof PaymentRefundedV1>): Promise<void> {
    const p = event.payload;
    await tx
      .insert(salesRefunds)
      .values({
        refundId: p.refundId,
        orderId: p.orderId,
        amount: p.refunded.amount,
        currency: p.refunded.currency,
        refundedAt: new Date(event.occurredAt),
      })
      .onConflictDoNothing();
  }
}
