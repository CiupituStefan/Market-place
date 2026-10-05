import { DomainError, ErrorCode } from '@market/types';
import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type {
  Intent,
  IntentRequest,
  IntentStatus,
  PaymentProvider,
  ProviderRefund,
  RefundStatus,
} from './provider.js';

/** Stripe API calls. Every mutating call carries an idempotency key, so retries are safe. */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger(StripeProvider.name);
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    readonly publishableKey: string,
  ) {
    // The API version is pinned by the SDK version: upgrading Stripe is a reviewed dependency bump.
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 10_000 });
  }

  async createIntent(request: IntentRequest, idempotencyKey: string): Promise<Intent> {
    return this.call('create payment intent', async () =>
      toIntent(
        await this.stripe.paymentIntents.create(
          {
            amount: request.amount,
            currency: request.currency.toLowerCase(),
            automatic_payment_methods: { enabled: true },
            receipt_email: request.email,
            description: `CSE Keyboards order ${request.orderNumber}`,
            metadata: {
              paymentId: request.paymentId,
              orderId: request.orderId,
              orderNumber: request.orderNumber,
            },
          },
          { idempotencyKey },
        ),
      ),
    );
  }

  async retrieveIntent(id: string): Promise<Intent> {
    return this.call('retrieve payment intent', async () =>
      toIntent(await this.stripe.paymentIntents.retrieve(id)),
    );
  }

  async cancelIntent(id: string): Promise<void> {
    await this.call('cancel payment intent', () => this.stripe.paymentIntents.cancel(id));
  }

  async createRefund(
    request: { paymentIntentId: string; amount: number; refundId: string; reason: string },
    idempotencyKey: string,
  ): Promise<ProviderRefund> {
    return this.call('create refund', async () => {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: request.paymentIntentId,
          amount: request.amount,
          ...(request.reason === 'duplicate' ||
          request.reason === 'fraudulent' ||
          request.reason === 'requested_by_customer'
            ? { reason: request.reason }
            : {}),
          metadata: { refundId: request.refundId },
        },
        { idempotencyKey },
      );
      return {
        id: refund.id,
        status: (refund.status ?? 'pending') as RefundStatus,
        amount: refund.amount,
      };
    });
  }

  private async call<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Stripe's message may contain account details: log it, never return it.
      this.logger.error(
        `stripe: ${what} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Payments are temporarily unavailable');
    }
  }
}

function toIntent(intent: {
  id: string;
  client_secret: string | null;
  status: string;
  amount: number;
  currency: string;
}): Intent {
  if (!intent.client_secret) throw new Error(`payment intent ${intent.id} has no client secret`);
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status as IntentStatus,
    amount: intent.amount,
    currency: intent.currency.toUpperCase(),
  };
}
