import { Authenticated, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import { DiscountTypeSchema, type DiscountCode } from '@market/types';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { DiscountService } from './discount.service.js';

const fields = {
  type: DiscountTypeSchema,
  /** Basis points for PERCENTAGE (1000 = 10%), minor units for FIXED. */
  value: z.int().positive().max(1_000_000),
  minSubtotal: z.int().positive().nullable(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  usageLimit: z.int().positive().nullable(),
  perCustomerLimit: z.int().positive().nullable(),
  active: z.boolean(),
};

const CreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,32}$/, '3–32 letters, digits, - or _'),
    ...fields,
    minSubtotal: fields.minSubtotal.default(null),
    startsAt: fields.startsAt.default(null),
    expiresAt: fields.expiresAt.default(null),
    usageLimit: fields.usageLimit.default(null),
    perCustomerLimit: fields.perCustomerLimit.default(null),
    active: fields.active.default(true),
  })
  .strict()
  .refine((input) => input.type !== 'PERCENTAGE' || input.value <= 10_000, {
    path: ['value'],
    message: 'A percentage is at most 10000 basis points',
  });

// No defaults: an omitted field must stay unchanged.
const UpdateSchema = z.object(fields).partial().strict();

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('discounts (back office)')
@Controller('discounts')
@Authenticated('STAFF', 'ADMIN')
export class DiscountsController {
  constructor(private readonly discounts: DiscountService) {}

  @Get()
  list(): Promise<DiscountCode[]> {
    return this.discounts.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a discount code' })
  @ApiBody({ schema: openApiSchema(CreateSchema) })
  create(
    @Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>,
  ): Promise<DiscountCode> {
    return this.discounts.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change limits, validity or deactivate a code' })
  @ApiBody({ schema: openApiSchema(UpdateSchema) })
  update(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>,
  ): Promise<DiscountCode> {
    return this.discounts.update(id, body);
  }
}
