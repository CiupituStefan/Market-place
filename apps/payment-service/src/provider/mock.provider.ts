import { randomBytes } from 'node:crypto';
import { DomainError, ErrorCode } from '@market/types';
import type { Intent, IntentRequest, PaymentProvider, ProviderRefund } from './provider.js';
import { signWebhook } from './webhook.js';

/**
 * Local stand-in for Stripe (development and tests only; refused in production).
 * It keeps intents in memory and, when a test payment is "confirmed", produces a
 * webhook event signed exactly like Stripe's, which then goes through the real
 * signature verification and webhook handling.
 */
export class MockProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  readonly publishableKey = 'mock';
  private readonly intents = new Map<string, Intent & { paymentId: string }>();
  private readonly byKey = new Map<string, string>();
  readonly refunds: (ProviderRefund & { paymentIntentId: string })[] = [];
  /** Tests can make the next refund stay pending (as Stripe sometimes does). */
  nextRefundStatus: ProviderRefund['status'] = 'succeeded';

  constructor(private readonly webhookSecret: string) {}

  createIntent(request: IntentRequest, idempotencyKey: string): Promise<Intent> {
    const existing = this.byKey.get(idempotencyKey);
    if (existing) return this.retrieveIntent(existing);
    const id = `pi_mock_${randomBytes(12).toString('hex')}`;
    const intent = {
      id,
      clientSecret: `${id}_secret_${randomBytes(12).toString('hex')}`,
      status: 'requires_payment_method' as const,
      amount: request.amount,
      currency: request.currency.toUpperCase(),
      paymentId: request.paymentId,
    };
    this.intents.set(id, intent);
    this.byKey.set(idempotencyKey, id);
    return Promise.resolve(intent);
  }

  retrieveIntent(id: string): Promise<Intent> {
    const intent = this.intents.get(id);
    if (!intent)
      return Promise.reject(new DomainError(ErrorCode.NOT_FOUND, 'Unknown payment intent'));
    return Promise.resolve(intent);
  }

  cancelIntent(id: string): Promise<void> {
    const intent = this.intents.get(id);
    if (intent && intent.status !== 'succeeded') intent.status = 'canceled';
    return Promise.resolve();
  }

  createRefund(
    request: { paymentIntentId: string; amount: number; refundId: string },
    idempotencyKey: string,
  ): Promise<ProviderRefund> {
    const existing = this.refunds.find((r) => r.id === `re_mock_${idempotencyKey}`);
    if (existing) return Promise.resolve(existing);
    const refund = {
      id: `re_mock_${idempotencyKey}`,
      status: this.nextRefundStatus,
      amount: request.amount,
      paymentIntentId: request.paymentIntentId,
    };
    this.nextRefundStatus = 'succeeded';
    this.refunds.push(refund);
    return Promise.resolve(refund);
  }

  /**
   * What Stripe does when the shopper submits the Payment Element: the intent
   * succeeds or fails, and a signed webhook event is produced.
   */
  confirm(
    clientSecret: string,
    outcome: 'succeed' | 'fail',
  ): { rawBody: Buffer; signature: string } {
    const intent = [...this.intents.values()].find((i) => i.clientSecret === clientSecret);
    if (!intent) throw new DomainError(ErrorCode.NOT_FOUND, 'Unknown payment intent');
    if (intent.status === 'succeeded' || intent.status === 'canceled') {
      throw new DomainError(ErrorCode.CONFLICT, `This payment is already ${intent.status}`);
    }
    intent.status = outcome === 'succeed' ? 'succeeded' : 'requires_payment_method';
    return this.event(
      outcome === 'succeed' ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
      {
        object: 'payment_intent',
        id: intent.id,
        status: intent.status,
        amount: intent.amount,
        amount_received: outcome === 'succeed' ? intent.amount : 0,
        currency: intent.currency.toLowerCase(),
        last_payment_error: outcome === 'fail' ? { message: 'Your card was declined.' } : null,
        metadata: { paymentId: intent.paymentId },
      },
    );
  }

  /** A signed refund.updated event (tests: settle a pending refund). */
  refundEvent(
    refundId: string,
    status: ProviderRefund['status'],
  ): { rawBody: Buffer; signature: string } {
    const refund = this.refunds.find((r) => r.id === refundId);
    if (!refund) throw new Error(`unknown refund ${refundId}`);
    refund.status = status;
    return this.event('refund.updated', {
      object: 'refund',
      id: refund.id,
      status,
      amount: refund.amount,
      payment_intent: refund.paymentIntentId,
      metadata: {},
    });
  }

  private event(type: string, object: Record<string, unknown>) {
    const payload = JSON.stringify({
      id: `evt_mock_${randomBytes(12).toString('hex')}`,
      object: 'event',
      type,
      created: Math.floor(Date.now() / 1000),
      data: { object },
    });
    return { rawBody: Buffer.from(payload), signature: signWebhook(payload, this.webhookSecret) };
  }
}
