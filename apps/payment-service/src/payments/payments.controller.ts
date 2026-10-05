import {
  MaybeUser,
  OptionallyAuthenticated,
  openApiSchema,
  readCookie,
  ZodValidationPipe,
} from '@market/nest-common';
import {
  CART_TOKEN_COOKIE,
  DomainError,
  ErrorCode,
  ORDER_TOKEN_HEADER,
  type AuthUser,
  type PaymentSession,
} from '@market/types';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBody, ApiExcludeEndpoint, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Viewer } from '../clients/orders.js';
import { PaymentService } from './payment.service.js';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const token = (value: string | undefined) => (value && TOKEN_FORMAT.test(value) ? value : null);

const SessionRequestSchema = z.object({ orderId: z.uuid() }).strict();

export function viewerOf(req: Request, user: AuthUser | undefined): Viewer {
  const orderToken = req.headers[ORDER_TOKEN_HEADER];
  return {
    userId: user?.id ?? null,
    roles: user?.roles ?? [],
    orderToken: token(typeof orderToken === 'string' ? orderToken : undefined),
    cartToken: token(readCookie(req.headers.cookie, CART_TOKEN_COOKIE)),
  };
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentService) {}

  @Post('create-intent')
  @HttpCode(200)
  @OptionallyAuthenticated()
  @ApiOperation({
    summary: 'Payment session for an unpaid order (Stripe Payment Element)',
    description:
      'The amount is the order total from order-service. Card details go from the browser straight to Stripe.',
  })
  @ApiHeader({ name: ORDER_TOKEN_HEADER, required: false })
  @ApiBody({ schema: openApiSchema(SessionRequestSchema) })
  async createIntent(
    @Body(new ZodValidationPipe(SessionRequestSchema)) body: z.infer<typeof SessionRequestSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<PaymentSession> {
    res.setHeader('Cache-Control', 'no-store');
    return this.payments.session(body.orderId, viewerOf(req, user));
  }

  /**
   * Stripe webhook endpoint. Authenticated by the Stripe-Signature HMAC over the
   * raw body, not by a session. Answers 2xx only once the event was handled, so
   * Stripe retries anything that failed.
   */
  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true; duplicate: boolean }> {
    if (!req.rawBody) {
      throw new DomainError(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Invalid webhook signature');
    }
    const { duplicate } = await this.payments.handleWebhook(req.rawBody, signature);
    return { received: true, duplicate };
  }
}
