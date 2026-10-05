import { ZodValidationPipe } from '@market/nest-common';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { MAX_LINE_QUANTITY, MAX_LINES } from '../stock/levels.js';
import { StockService, type StockItemView } from '../stock/stock.service.js';
import { ReservationService, type ReservationView } from './reservation.service.js';

const ReserveSchema = z
  .object({
    orderId: z.uuid(),
    lines: z
      .array(
        z.object({ variantId: z.uuid(), quantity: z.int().min(1).max(MAX_LINE_QUANTITY) }).strict(),
      )
      .min(1)
      .max(MAX_LINES),
    ttlSeconds: z.int().min(60).max(3_600).optional(),
  })
  .strict();

const ReleaseSchema = z
  .object({ reason: z.enum(['PAYMENT_FAILED', 'ORDER_CANCELLED', 'MANUAL']) })
  .strict();
const VariantIdsSchema = z.object({ variantIds: z.array(z.uuid()).min(1).max(200) }).strict();
const SyncSchema = z
  .object({
    variants: z
      .array(z.object({ variantId: z.uuid(), sku: z.string().min(1).max(64) }).strict())
      .max(500),
  })
  .strict();

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * Service-to-service API (order-service drives reservations, cart-service reads
 * availability). Not routable through the gateway; restricted by NetworkPolicy.
 */
@ApiExcludeController()
@Controller('internal')
export class InternalController {
  constructor(
    private readonly reservations: ReservationService,
    private readonly stock: StockService,
  ) {}

  /** 201 when created, 200 when the same order already had this reservation (idempotent retry). */
  @Post('reservations')
  async reserve(
    @Body(new ZodValidationPipe(ReserveSchema)) body: z.infer<typeof ReserveSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservationView> {
    const { reservation, created } = await this.reservations.reserve(
      body.orderId,
      body.lines,
      body.ttlSeconds,
    );
    res.status(created ? 201 : 200);
    return reservation;
  }

  @Get('reservations/:id')
  get(@Param('id', uuid) id: string): Promise<ReservationView> {
    return this.reservations.get(id);
  }

  @Post('reservations/:id/confirm')
  @HttpCode(200)
  confirm(@Param('id', uuid) id: string): Promise<ReservationView> {
    return this.reservations.confirm(id);
  }

  @Post('reservations/:id/release')
  @HttpCode(200)
  release(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ReleaseSchema)) body: z.infer<typeof ReleaseSchema>,
  ): Promise<ReservationView> {
    return this.reservations.release(id, body.reason);
  }

  @Post('availability')
  @HttpCode(200)
  availability(
    @Body(new ZodValidationPipe(VariantIdsSchema)) body: { variantIds: string[] },
  ): Promise<StockItemView[]> {
    return this.stock.availability(body.variantIds);
  }

  @Post('variants/sync')
  @HttpCode(200)
  async sync(
    @Body(new ZodValidationPipe(SyncSchema)) body: z.infer<typeof SyncSchema>,
  ): Promise<{ synced: number }> {
    return { synced: await this.stock.syncVariants(body.variants) };
  }
}
