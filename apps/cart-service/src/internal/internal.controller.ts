import { ZodValidationPipe } from '@market/nest-common';
import type { Cart } from '@market/types';
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { z } from 'zod';
import { CartService } from '../cart/cart.service.js';
import { DiscountService, type Redemption } from '../discounts/discount.service.js';

const PricedCartSchema = z
  .object({
    userId: z.uuid().nullable().default(null),
    guestToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .nullable()
      .default(null),
  })
  .strict()
  .refine((body) => body.userId !== null || body.guestToken !== null, {
    message: 'userId or guestToken is required',
  });

const RedeemSchema = z
  .object({
    code: z.string().trim().min(1).max(40),
    orderId: z.uuid(),
    userId: z.uuid().nullable(),
    subtotal: z.int().nonnegative(),
  })
  .strict();

const ReleaseSchema = z.object({ orderId: z.uuid() }).strict();
const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * Service-to-service API for order-service. Not routable through the gateway
 * (`/internal` is blocked there) and restricted by NetworkPolicy.
 */
@ApiExcludeController()
@Controller('internal')
export class InternalController {
  constructor(
    private readonly carts: CartService,
    private readonly discounts: DiscountService,
  ) {}

  /** The authoritative, freshly priced cart that checkout turns into an order. */
  @Post('carts/priced')
  @HttpCode(200)
  priced(
    @Body(new ZodValidationPipe(PricedCartSchema)) body: z.infer<typeof PricedCartSchema>,
  ): Promise<Cart> {
    return this.carts.pricedFor(body);
  }

  /** Empties a cart once its order is placed. Idempotent. */
  @Post('carts/:id/clear')
  @HttpCode(204)
  async clear(@Param('id', uuid) id: string): Promise<void> {
    await this.carts.clear(id);
  }

  @Post('discounts/redeem')
  @HttpCode(200)
  redeem(
    @Body(new ZodValidationPipe(RedeemSchema)) body: z.infer<typeof RedeemSchema>,
  ): Promise<Redemption> {
    return this.discounts.redeem(body);
  }

  @Post('discounts/release')
  @HttpCode(200)
  release(
    @Body(new ZodValidationPipe(ReleaseSchema)) body: z.infer<typeof ReleaseSchema>,
  ): Promise<{ released: boolean }> {
    return this.discounts.release(body.orderId);
  }
}
