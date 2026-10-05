import { ZodValidationPipe } from '@market/nest-common';
import { CURRENCIES, type Order } from '@market/types';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { z } from 'zod';
import { OrderService, type PaymentOutcome } from '../orders/order.service.js';

const PaymentSucceededSchema = z
  .object({ paymentId: z.uuid(), amount: z.int().positive(), currency: z.enum(CURRENCIES) })
  .strict();
const PaymentFailedSchema = z.object({ message: z.string().max(500).nullable() }).strict();

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * Service-to-service API for payment-service. Not routable through the gateway
 * (`/internal` is blocked there) and restricted by NetworkPolicy. Payment status
 * reaches orders only from here, driven by verified Stripe webhooks — never from
 * the browser.
 */
@ApiExcludeController()
@Controller('internal/orders')
export class InternalController {
  constructor(private readonly orders: OrderService) {}

  /** The authoritative amount to charge. */
  @Get(':id')
  get(@Param('id', uuid) id: string): Promise<Order> {
    return this.orders.get(id);
  }

  @Post(':id/payment-succeeded')
  @HttpCode(200)
  paymentSucceeded(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(PaymentSucceededSchema))
    body: z.infer<typeof PaymentSucceededSchema>,
  ): Promise<{ order: Order; outcome: PaymentOutcome }> {
    return this.orders.paymentSucceeded(id, body);
  }

  @Post(':id/payment-failed')
  @HttpCode(200)
  paymentFailed(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(PaymentFailedSchema)) body: z.infer<typeof PaymentFailedSchema>,
  ): Promise<Order> {
    return this.orders.paymentFailed(id, body.message);
  }
}
