import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import { RefundReasonSchema, type AuthUser, type Payment } from '@market/types';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PaymentService } from './payment.service.js';

const ListQuery = z.object({ orderId: z.uuid() });
const RefundSchema = z
  .object({
    /** Minor units; omitted = everything still refundable. */
    amount: z.int().positive().optional(),
    reason: RefundReasonSchema.exclude(['order_unfulfillable']),
  })
  .strict();

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('payments (back office)')
@Controller('payments/manage')
@Authenticated('STAFF', 'ADMIN')
export class ManagePaymentsController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  @ApiOperation({ summary: 'Payments (and their refunds) of an order' })
  list(
    @Query(new ZodValidationPipe(ListQuery)) query: z.infer<typeof ListQuery>,
  ): Promise<Payment[]> {
    return this.payments.listForOrder(query.orderId);
  }

  @Get(':id')
  get(@Param('id', uuid) id: string): Promise<Payment> {
    return this.payments.get(id);
  }

  @Post(':id/refunds')
  @ApiOperation({ summary: 'Refund all or part of a completed payment' })
  @ApiBody({ schema: openApiSchema(RefundSchema) })
  refund(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(RefundSchema)) body: z.infer<typeof RefundSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<Payment> {
    return this.payments.refund(id, body, user.id);
  }
}
