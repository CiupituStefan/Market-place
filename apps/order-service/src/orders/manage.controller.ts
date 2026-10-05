import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import {
  OrderStatusSchema,
  PaginationQuerySchema,
  type AuthUser,
  type Order,
  type OrderSummary,
  type Paginated,
} from '@market/types';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { OrderService } from './order.service.js';

const ListQuery = PaginationQuerySchema.extend({
  status: OrderStatusSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  userId: z.uuid().optional(),
});

const StatusChangeSchema = z
  .object({
    status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    carrier: z.string().trim().min(1).max(60).optional(),
    trackingNumber: z.string().trim().min(3).max(60).optional(),
    trackingUrl: z
      .url({ protocol: /^https$/ })
      .max(500)
      .nullable()
      .optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

const uuid = new ParseUUIDPipe({ version: '4' });

/** Back office (STAFF/ADMIN): every order, including internal checkout states. */
@ApiTags('orders (back office)')
@Controller('orders/manage')
@Authenticated('STAFF', 'ADMIN')
export class ManageOrdersController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @ApiOperation({
    summary: 'All orders, newest first; filter by status or customer, search number/email',
  })
  list(
    @Query(new ZodValidationPipe(ListQuery)) query: z.infer<typeof ListQuery>,
  ): Promise<Paginated<OrderSummary>> {
    return this.orders.listAll({ status: query.status, q: query.q, userId: query.userId }, query);
  }

  @Get(':id')
  get(@Param('id', uuid) id: string): Promise<Order> {
    return this.orders.get(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Advance fulfilment (processing → shipped → delivered) or cancel an unpaid order',
  })
  @ApiBody({ schema: openApiSchema(StatusChangeSchema) })
  changeStatus(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(StatusChangeSchema)) body: z.infer<typeof StatusChangeSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<Order> {
    if (body.status === 'CANCELLED') return this.orders.cancel(id, 'ADMIN', user.id);
    return this.orders.advance(id, body.status, body, user.id);
  }
}
