import { ZodValidationPipe } from '@market/nest-common';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { z } from 'zod';
import { MockProvider } from '../provider/mock.provider.js';
import { PAYMENT_PROVIDER } from '../provider/provider.js';
import { PaymentService } from './payment.service.js';

const ConfirmSchema = z
  .object({ clientSecret: z.string().min(10).max(200), outcome: z.enum(['succeed', 'fail']) })
  .strict();

/**
 * Local development only (registered when PAYMENT_PROVIDER=mock, which is refused
 * in production): plays the part of Stripe confirming a payment, then feeds the
 * signed event through the real webhook path.
 */
@ApiExcludeController()
@Controller('payments/mock')
export class MockPaymentsController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: MockProvider,
    private readonly payments: PaymentService,
  ) {}

  @Post('confirm')
  @HttpCode(200)
  async confirm(
    @Body(new ZodValidationPipe(ConfirmSchema)) body: z.infer<typeof ConfirmSchema>,
  ): Promise<{ status: 'succeeded' | 'requires_payment_method' }> {
    const { rawBody, signature } = this.provider.confirm(body.clientSecret, body.outcome);
    await this.payments.handleWebhook(rawBody, signature);
    return { status: body.outcome === 'succeed' ? 'succeeded' : 'requires_payment_method' };
  }
}
