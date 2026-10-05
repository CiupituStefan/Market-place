import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import type { AuthUser, Paginated } from '@market/types';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { MovementRow } from '../db/schema.js';
import { ReservationService, type ReservationView } from '../reservations/reservation.service.js';
import { StockService, type StockItemView } from './stock.service.js';

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(64).optional(),
  lowStock: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => v !== undefined),
});

const AdjustmentSchema = z
  .object({
    type: z.enum(['RECEIVED', 'ADJUSTMENT']),
    delta: z
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((n) => n !== 0, 'Must not be zero'),
    reason: z.string().trim().min(3).max(200),
  })
  .strict();

const ThresholdSchema = z.object({ lowStockThreshold: z.int().min(0).max(1_000) }).strict();

const ReservationsQuery = z.object({
  status: z.enum(['ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const uuid = new ParseUUIDPipe({ version: '4' });

/** Back-office stock management (STAFF and ADMIN). */
@ApiTags('inventory (back office)')
@Controller('inventory')
@Authenticated('STAFF', 'ADMIN')
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly reservations: ReservationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Stock levels, least available first (lowStock=1 for alerts)' })
  list(
    @Query(new ZodValidationPipe(ListQuery)) query: z.infer<typeof ListQuery>,
  ): Promise<Paginated<StockItemView>> {
    return this.stock.list(query);
  }

  @Get('reservations')
  @ApiOperation({ summary: 'Reservations by status, soonest expiry first' })
  listReservations(
    @Query(new ZodValidationPipe(ReservationsQuery)) query: z.infer<typeof ReservationsQuery>,
  ): Promise<ReservationView[]> {
    return this.reservations.list(query.status, query.limit);
  }

  @Get(':variantId')
  get(@Param('variantId', uuid) variantId: string): Promise<StockItemView> {
    return this.stock.get(variantId);
  }

  @Get(':variantId/movements')
  @ApiOperation({ summary: 'Stock ledger for a variant, newest first' })
  movements(@Param('variantId', uuid) variantId: string): Promise<MovementRow[]> {
    return this.stock.movements(variantId, 100);
  }

  @Post(':variantId/adjustments')
  @ApiOperation({ summary: 'Record received goods or a stock correction' })
  @ApiBody({ schema: openApiSchema(AdjustmentSchema) })
  adjust(
    @Param('variantId', uuid) variantId: string,
    @Body(new ZodValidationPipe(AdjustmentSchema)) body: z.infer<typeof AdjustmentSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<StockItemView> {
    return this.stock.adjust(variantId, body, user.id);
  }

  @Patch(':variantId')
  @ApiBody({ schema: openApiSchema(ThresholdSchema) })
  setThreshold(
    @Param('variantId', uuid) variantId: string,
    @Body(new ZodValidationPipe(ThresholdSchema)) body: z.infer<typeof ThresholdSchema>,
  ): Promise<StockItemView> {
    return this.stock.setThreshold(variantId, body.lowStockThreshold);
  }
}
