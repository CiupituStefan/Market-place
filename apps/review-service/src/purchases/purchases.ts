import type { EventEnvelope } from '@market/events';
import type { OrderCancelledV1, OrderCreatedV1, OrderPaidV1 } from '@market/events';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { CatalogGateway } from '../clients/catalog.js';
import type { Database } from '../db/database.js';
import { purchases, reviews } from '../db/schema.js';

/**
 * Which signed-in shoppers bought which products — the "verified purchase" badge.
 * OrderCreated records the products (variants resolved through product-service),
 * OrderPaid confirms them, OrderCancelled removes them. Guest orders are skipped:
 * a review needs an account.
 */
export class PurchaseProjection {
  constructor(
    private readonly db: Database,
    private readonly catalog: CatalogGateway,
  ) {}

  /** Calls product-service, so it runs outside the inbox transaction; idempotent (ON CONFLICT). */
  async onOrderCreated(event: EventEnvelope<typeof OrderCreatedV1>): Promise<void> {
    const { orderId, userId, lines } = event.payload;
    if (!userId) return;
    const variantIds = lines.flatMap((line) => (line.variantId ? [line.variantId] : []));
    const productOf = await this.catalog.productIdsOfVariants(variantIds);
    const productIds = [...new Set(productOf.values())];
    if (productIds.length === 0) return;
    await this.db
      .insert(purchases)
      .values(productIds.map((productId) => ({ orderId, productId, userId })))
      .onConflictDoNothing();
  }

  /** Database-only, in the inbox transaction. Also upgrades reviews written before payment settled. */
  async onOrderPaid(tx: Database, event: EventEnvelope<typeof OrderPaidV1>): Promise<void> {
    const paid = await tx
      .update(purchases)
      .set({ paid: true })
      .where(eq(purchases.orderId, event.payload.orderId))
      .returning();
    for (const purchase of paid) {
      await tx
        .update(reviews)
        .set({ verifiedPurchase: true })
        .where(and(eq(reviews.userId, purchase.userId), eq(reviews.productId, purchase.productId)));
    }
  }

  async onOrderCancelled(
    tx: Database,
    event: EventEnvelope<typeof OrderCancelledV1>,
  ): Promise<void> {
    const removed = await tx
      .delete(purchases)
      .where(eq(purchases.orderId, event.payload.orderId))
      .returning();
    // Withdraw the badge only if no other paid order of that product remains.
    for (const purchase of removed) {
      const [other] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(purchases)
        .where(
          and(
            eq(purchases.userId, purchase.userId),
            eq(purchases.productId, purchase.productId),
            eq(purchases.paid, true),
          ),
        );
      if ((other?.n ?? 0) === 0) {
        await tx
          .update(reviews)
          .set({ verifiedPurchase: false })
          .where(
            and(
              eq(reviews.userId, purchase.userId),
              inArray(reviews.productId, [purchase.productId]),
            ),
          );
      }
    }
  }
}
