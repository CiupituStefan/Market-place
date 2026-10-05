import { randomUUID } from 'node:crypto';
import { enqueueEvent, isUniqueViolation } from '@market/db';
import {
  PaymentCreatedV1,
  PaymentFailedV1,
  PaymentRefundedV1,
  PaymentSucceededV1,
} from '@market/events';
import {
  DomainError,
  ErrorCode,
  money,
  type Currency,
  type Payment,
  type PaymentSession,
  type RefundReason,
} from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { ORDERS, type OrdersGateway, type Viewer } from '../clients/orders.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { payments, refunds, webhookEvents, type PaymentRow, type RefundRow } from '../db/schema.js';
import {
  PAYMENT_PROVIDER,
  type Intent,
  type PaymentProvider,
  type RefundStatus,
} from '../provider/provider.js';
import { verifyWebhook, type ProviderEvent } from '../provider/webhook.js';

const OPEN = ['REQUIRES_PAYMENT', 'PROCESSING'] as const;
const REFUNDABLE = ['SUCCEEDED', 'PARTIALLY_REFUNDED'] as const;

type IntentEvent = Extract<ProviderEvent, { kind: 'payment_intent' }>;
type RefundEvent = Extract<ProviderEvent, { kind: 'refund' }>;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ORDERS) private readonly orders: OrdersGateway,
  ) {}

  // ── paying ─────────────────────────────────────────────────────────────────

  /**
   * Returns the PaymentIntent session for an order, creating it on first use.
   * The amount comes from order-service (never from the browser), and one open
   * intent per order is enforced by a partial unique index, so repeated or
   * concurrent "pay" requests share it.
   */
  async session(orderId: string, viewer: Viewer): Promise<PaymentSession> {
    const order = await this.orders.accessible(orderId, viewer);
    if (order.status !== 'PENDING_PAYMENT') {
      throw new DomainError(
        ErrorCode.INVALID_ORDER_STATE,
        order.status === 'PAID' ? 'This order is already paid' : 'This order can no longer be paid',
      );
    }

    let payment = await this.openPayment(orderId);
    if (!payment) {
      try {
        [payment] = await this.db
          .insert(payments)
          .values({
            id: randomUUID(),
            orderId,
            orderNumber: order.number,
            provider: this.provider.name,
            status: 'REQUIRES_PAYMENT',
            amount: order.total.amount,
            currency: order.total.currency,
          })
          .returning();
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        payment = await this.openPayment(orderId); // a concurrent request created it
      }
      if (!payment) throw new DomainError(ErrorCode.CONFLICT, 'Please try again');
    }

    let intent: Intent;
    if (payment.providerPaymentId) {
      intent = await this.provider.retrieveIntent(payment.providerPaymentId);
    } else {
      // Same idempotency key for concurrent creators: Stripe returns one intent.
      intent = await this.provider.createIntent(
        {
          paymentId: payment.id,
          orderId,
          orderNumber: order.number,
          amount: payment.amount,
          currency: payment.currency,
          email: order.email,
        },
        `payment:${payment.id}`,
      );
      const paymentRow = payment;
      await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(payments)
          .set({ providerPaymentId: intent.id, updatedAt: new Date() })
          .where(and(eq(payments.id, paymentRow.id), sql`${payments.providerPaymentId} IS NULL`))
          .returning();
        if (updated) {
          await enqueueEvent(tx, PaymentCreatedV1, this.ref(updated, intent.id), {
            producer: SERVICE_NAME,
            aggregateId: updated.orderId,
          });
        }
      });
    }
    return {
      paymentId: payment.id,
      provider: this.provider.name,
      publishableKey: this.provider.publishableKey,
      clientSecret: intent.clientSecret,
      amount: money(payment.amount, payment.currency as Currency),
      status: payment.status,
    };
  }

  // ── webhooks ───────────────────────────────────────────────────────────────

  /**
   * Processes a Stripe webhook. Stripe is the only source of truth for payment
   * status: the browser's "payment complete" redirect changes nothing here.
   * Duplicate deliveries are acknowledged without effect (inbox table); a
   * failure answers 5xx so Stripe retries, and every step is idempotent.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ duplicate: boolean }> {
    const event = verifyWebhook(
      rawBody,
      signature,
      this.config.STRIPE_WEBHOOK_SECRET,
      this.config.WEBHOOK_TOLERANCE_SECONDS,
    );
    const [seen] = await this.db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id));
    if (seen) return { duplicate: true };

    if (event.kind === 'payment_intent') await this.onIntentEvent(event);
    else if (event.kind === 'refund') await this.onRefundEvent(event);

    await this.db
      .insert(webhookEvents)
      .values({ eventId: event.id, type: event.type })
      .onConflictDoNothing();
    return { duplicate: false };
  }

  private async onIntentEvent(event: IntentEvent): Promise<void> {
    const { intent } = event;
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, intent.id));
    if (!payment) {
      // Not ours (another integration on the same Stripe account) or not yet linked.
      this.logger.warn(`${event.type} for unknown payment intent ${intent.id}`);
      return;
    }
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.onSucceeded(payment, event);
        return;
      case 'payment_intent.payment_failed':
        await this.onFailed(payment, event);
        return;
      case 'payment_intent.processing':
        await this.db
          .update(payments)
          .set({ status: 'PROCESSING', updatedAt: new Date() })
          .where(and(eq(payments.id, payment.id), eq(payments.status, 'REQUIRES_PAYMENT')));
        return;
      case 'payment_intent.canceled':
        await this.db
          .update(payments)
          .set({ status: 'CANCELED', updatedAt: new Date() })
          .where(and(eq(payments.id, payment.id), inArray(payments.status, [...OPEN])));
        return;
      default:
        return;
    }
  }

  private async onSucceeded(payment: PaymentRow, event: IntentEvent): Promise<void> {
    const { intent } = event;
    const amountMatches =
      intent.amountReceived === payment.amount && intent.currency === payment.currency;
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(payments)
        .set({
          status: 'SUCCEEDED',
          succeededAt: new Date(),
          lastError: amountMatches
            ? null
            : `received ${String(intent.amountReceived)} ${intent.currency}`,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.id, payment.id), inArray(payments.status, [...OPEN, 'FAILED'])))
        .returning();
      if (updated) {
        await enqueueEvent(
          tx,
          PaymentSucceededV1,
          {
            ...this.ref(updated, intent.id),
            stripeEventId: event.id,
            succeededAt: new Date().toISOString(),
          },
          { producer: SERVICE_NAME, aggregateId: updated.orderId },
        );
      }
    });

    if (!amountMatches) {
      // Never ship an order that was not paid in full: give the money back.
      this.logger.error(`payment ${payment.id}: amount received does not match; refunding`);
      await this.refund(
        payment.id,
        { reason: 'order_unfulfillable' },
        'system',
        `refund:auto:${payment.id}`,
      );
      return;
    }
    // Idempotent on the order side, so a redelivered event simply re-confirms.
    const { outcome } = await this.orders.paymentSucceeded(payment.orderId, {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    });
    if (outcome === 'REFUND_REQUIRED') {
      this.logger.warn(
        `order ${payment.orderNumber} cannot be fulfilled; refunding payment ${payment.id}`,
      );
      await this.refund(
        payment.id,
        { reason: 'order_unfulfillable' },
        'system',
        `refund:auto:${payment.id}`,
      );
    }
  }

  private async onFailed(payment: PaymentRow, event: IntentEvent): Promise<void> {
    const { intent } = event;
    await this.db.transaction(async (tx) => {
      // The intent stays usable: Stripe lets the shopper try another card.
      await tx
        .update(payments)
        .set({ lastError: intent.lastError, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      await enqueueEvent(
        tx,
        PaymentFailedV1,
        {
          ...this.ref(payment, intent.id),
          stripeEventId: event.id,
          failureCode: null,
          failureMessage: intent.lastError,
        },
        { producer: SERVICE_NAME, aggregateId: payment.orderId },
      );
    });
    await this.orders.paymentFailed(payment.orderId, intent.lastError);
  }

  private async onRefundEvent(event: RefundEvent): Promise<void> {
    const [refund] = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.providerRefundId, event.refund.id));
    if (!refund) {
      this.logger.warn(`${event.type} for unknown refund ${event.refund.id}`);
      return;
    }
    await this.settleRefund(refund.id, event.refund.status as RefundStatus);
  }

  // ── order events (Kafka) ───────────────────────────────────────────────────

  /**
   * OrderCancelled: an unpaid order must not be payable any more, so its open
   * PaymentIntent is cancelled at Stripe. If the shopper's payment already went
   * through, the intent is left alone: its webhook reaches order-service, which
   * answers REFUND_REQUIRED, and the payment is refunded. When the event itself
   * says a refund is required, captured payments are refunded here too (the same
   * idempotency key as the webhook path, so never twice). Idempotent.
   */
  async onOrderCancelled(orderId: string, refundRequired: boolean): Promise<void> {
    const rows = await this.db.select().from(payments).where(eq(payments.orderId, orderId));
    for (const payment of rows) {
      if ((OPEN as readonly string[]).includes(payment.status) && payment.providerPaymentId) {
        const intent = await this.provider.retrieveIntent(payment.providerPaymentId);
        if (intent.status === 'succeeded' || intent.status === 'processing') continue;
        if (intent.status !== 'canceled')
          await this.provider.cancelIntent(payment.providerPaymentId);
        await this.db
          .update(payments)
          .set({ status: 'CANCELED', updatedAt: new Date() })
          .where(and(eq(payments.id, payment.id), inArray(payments.status, [...OPEN])));
        this.logger.log(`payment ${payment.id} cancelled with its order ${payment.orderNumber}`);
      }
      if (refundRequired && (REFUNDABLE as readonly string[]).includes(payment.status)) {
        await this.refund(
          payment.id,
          { reason: 'order_unfulfillable' },
          'system',
          `refund:auto:${payment.id}`,
        );
      }
    }
  }

  // ── refunds ────────────────────────────────────────────────────────────────

  /**
   * Refunds all or part of a captured payment. The payment row is locked so two
   * refunds can never exceed what was paid (also a CHECK constraint).
   * `idempotencyKey` makes automatic refunds safe to repeat.
   */
  async refund(
    paymentId: string,
    input: { amount?: number; reason: RefundReason },
    actor: string,
    idempotencyKey?: string,
  ): Promise<Payment> {
    const created = await this.db.transaction(
      async (tx): Promise<{ id: string; status: RefundStatus | null }> => {
        const [payment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, paymentId))
          .for('update');
        if (!payment) throw new DomainError(ErrorCode.NOT_FOUND, 'Payment not found');
        if (idempotencyKey) {
          const [earlier] = await tx
            .select()
            .from(refunds)
            .where(and(eq(refunds.paymentId, paymentId), eq(refunds.reason, input.reason)));
          if (earlier && earlier.status !== 'FAILED' && earlier.status !== 'CANCELED')
            return { id: earlier.id, status: null };
        }
        if (
          !(REFUNDABLE as readonly string[]).includes(payment.status) ||
          !payment.providerPaymentId
        ) {
          throw new DomainError(
            ErrorCode.INVALID_ORDER_STATE,
            'Only completed payments can be refunded',
          );
        }
        const pending = await tx
          .select({ amount: refunds.amount })
          .from(refunds)
          .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, 'PENDING')));
        const refundable =
          payment.amount - payment.refundedAmount - pending.reduce((sum, r) => sum + r.amount, 0);
        const amount = input.amount ?? refundable;
        if (amount <= 0 || amount > refundable) {
          throw new DomainError(
            ErrorCode.REFUND_EXCEEDS_PAYMENT,
            `At most ${(refundable / 100).toFixed(2)} ${payment.currency} can still be refunded`,
          );
        }
        const id = randomUUID();
        await tx.insert(refunds).values({
          id,
          paymentId,
          amount,
          status: 'PENDING',
          reason: input.reason,
          requestedBy: actor,
        });
        const providerRefund = await this.provider.createRefund(
          {
            paymentIntentId: payment.providerPaymentId,
            amount,
            refundId: id,
            reason: input.reason,
          },
          idempotencyKey ?? `refund:${id}`,
        );
        await tx
          .update(refunds)
          .set({ providerRefundId: providerRefund.id, updatedAt: new Date() })
          .where(eq(refunds.id, id));
        return { id, status: providerRefund.status };
      },
    );

    // Refunds of card payments usually settle at once; others settle via webhook.
    if (created.status) await this.settleRefund(created.id, created.status);
    else await this.notifyOrder(created.id); // a repeated automatic refund: make sure the order knows
    return this.get(paymentId);
  }

  /** Applies a refund's final status once (idempotent), then tells order-service. */
  private async settleRefund(refundId: string, status: RefundStatus): Promise<void> {
    const final =
      status === 'succeeded'
        ? 'SUCCEEDED'
        : status === 'failed'
          ? 'FAILED'
          : status === 'canceled'
            ? 'CANCELED'
            : null;
    if (final) {
      await this.db.transaction(async (tx) => {
        const [refund] = await tx
          .select()
          .from(refunds)
          .where(eq(refunds.id, refundId))
          .for('update');
        if (refund?.status !== 'PENDING') return;
        const [payment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, refund.paymentId))
          .for('update');
        if (!payment) return;
        await tx
          .update(refunds)
          .set({ status: final, updatedAt: new Date() })
          .where(eq(refunds.id, refundId));
        if (final !== 'SUCCEEDED') {
          this.logger.error(`refund ${refundId} of payment ${payment.id} ${final.toLowerCase()}`);
          return;
        }
        const refunded = payment.refundedAmount + refund.amount;
        const full = refunded === payment.amount;
        const [updated] = await tx
          .update(payments)
          .set({
            refundedAmount: refunded,
            status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id))
          .returning();
        const currency = payment.currency as Currency;
        await enqueueEvent(
          tx,
          PaymentRefundedV1,
          {
            ...this.ref(updated ?? payment, payment.providerPaymentId ?? ''),
            refundId,
            stripeRefundId: refund.providerRefundId ?? '',
            refunded: money(refund.amount, currency),
            totalRefunded: money(refunded, currency),
            isFullRefund: full,
          },
          { producer: SERVICE_NAME, aggregateId: payment.orderId },
        );
      });
    }
    await this.notifyOrder(refundId);
  }

  /** Tells order-service about a settled refund exactly once (retried on the next event if it fails). */
  private async notifyOrder(refundId: string): Promise<void> {
    const [refund] = await this.db.select().from(refunds).where(eq(refunds.id, refundId));
    if (refund?.status !== 'SUCCEEDED' || refund.orderNotifiedAt) return;
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, refund.paymentId));
    if (!payment) return;
    await this.orders.refunded(payment.orderId, {
      paymentId: payment.id,
      amount: refund.amount,
      full: payment.refundedAmount === payment.amount,
    });
    await this.db
      .update(refunds)
      .set({ orderNotifiedAt: new Date() })
      .where(eq(refunds.id, refundId));
  }

  // ── queries ────────────────────────────────────────────────────────────────

  async listForOrder(orderId: string): Promise<Payment[]> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async get(paymentId: string): Promise<Payment> {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    if (!row) throw new DomainError(ErrorCode.NOT_FOUND, 'Payment not found');
    return this.view(row);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async openPayment(orderId: string): Promise<PaymentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), inArray(payments.status, [...OPEN])));
    return row;
  }

  private ref(payment: PaymentRow, providerPaymentId: string) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      stripePaymentIntentId: providerPaymentId,
      amount: money(payment.amount, payment.currency as Currency),
    };
  }

  private async view(row: PaymentRow): Promise<Payment> {
    const currency = row.currency as Currency;
    const rows: RefundRow[] = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.paymentId, row.id))
      .orderBy(desc(refunds.createdAt));
    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      provider: row.provider,
      providerPaymentId: row.providerPaymentId,
      status: row.status,
      amount: money(row.amount, currency),
      refunded: money(row.refundedAmount, currency),
      lastError: row.lastError,
      succeededAt: row.succeededAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      refunds: rows.map((r) => ({
        id: r.id,
        amount: money(r.amount, currency),
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
