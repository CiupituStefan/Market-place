import {
  Authenticated,
  CurrentUser,
  MaybeUser,
  OptionallyAuthenticated,
  openApiSchema,
  readCookie,
  ZodValidationPipe,
} from '@market/nest-common';
import {
  CART_TOKEN_COOKIE,
  CheckoutRequestSchema,
  DomainError,
  ErrorCode,
  IDEMPOTENCY_KEY_HEADER,
  ORDER_TOKEN_HEADER,
  PaginationQuerySchema,
  type AuthUser,
  type Order,
  type OrderSummary,
  type Paginated,
  type PaginationQuery,
  type PlacedOrder,
} from '@market/types';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CheckoutService, type CheckoutInput } from './checkout.service.js';
import { OrderService, type Viewer } from './order.service.js';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const IDEMPOTENCY_KEY_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;
const uuid = new ParseUUIDPipe({ version: '4' });

function token(value: string | undefined): string | null {
  return value && TOKEN_FORMAT.test(value) ? value : null;
}

function viewerOf(
  req: Request,
  user: AuthUser | undefined,
  orderToken: string | undefined,
): Viewer {
  return {
    userId: user?.id ?? null,
    roles: user?.roles ?? [],
    orderToken: token(orderToken),
    cartToken: token(readCookie(req.headers.cookie, CART_TOKEN_COOKIE)),
  };
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrderService,
  ) {}

  @Post()
  @OptionallyAuthenticated()
  @ApiOperation({
    summary: 'Place an order from the current cart',
    description:
      'Prices come from cart-service, never from this request. Retrying with the same Idempotency-Key returns the same order. Guests receive an accessToken for viewing the order.',
  })
  @ApiHeader({ name: IDEMPOTENCY_KEY_HEADER, required: true })
  @ApiBody({ schema: openApiSchema(CheckoutRequestSchema) })
  async place(
    @Body(new ZodValidationPipe(CheckoutRequestSchema)) body: CheckoutInput,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<PlacedOrder> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_FORMAT.test(idempotencyKey)) {
      throw new DomainError(
        ErrorCode.VALIDATION_FAILED,
        'A valid Idempotency-Key header is required',
        [{ path: IDEMPOTENCY_KEY_HEADER, message: '8–128 letters, digits, - or _' }],
      );
    }
    const { order, replayed } = await this.checkout.place(
      {
        userId: user?.id ?? null,
        guestToken: token(readCookie(req.headers.cookie, CART_TOKEN_COOKIE)),
      },
      idempotencyKey,
      body,
    );
    res.status(replayed ? 200 : 201);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    res.setHeader('Cache-Control', 'no-store');
    return order;
  }

  @Get()
  @Authenticated()
  @ApiOperation({ summary: 'My orders, newest first' })
  list(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<OrderSummary>> {
    return this.orders.listForUser(user.id, query);
  }

  @Get(':id')
  @OptionallyAuthenticated()
  @ApiHeader({ name: ORDER_TOKEN_HEADER, required: false, description: 'Guest order access token' })
  get(
    @Param('id', uuid) id: string,
    @Headers(ORDER_TOKEN_HEADER) orderToken: string | undefined,
    @Req() req: Request,
    @MaybeUser() user?: AuthUser,
  ): Promise<Order> {
    return this.orders.getForViewer(id, viewerOf(req, user, orderToken));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @OptionallyAuthenticated()
  @ApiOperation({ summary: 'Cancel an order that has not been paid yet' })
  cancel(
    @Param('id', uuid) id: string,
    @Headers(ORDER_TOKEN_HEADER) orderToken: string | undefined,
    @Req() req: Request,
    @MaybeUser() user?: AuthUser,
  ): Promise<Order> {
    return this.orders.cancelByCustomer(id, viewerOf(req, user, orderToken));
  }
}
