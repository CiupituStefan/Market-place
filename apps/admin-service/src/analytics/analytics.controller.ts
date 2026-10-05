import { Authenticated, ZodValidationPipe } from '@market/nest-common';
import {
  DateRangeQuerySchema,
  type BestSeller,
  type CustomerStats,
  type DailySales,
  type DateRangeQuery,
  type SalesSummary,
} from '@market/types';
import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { addDays, AnalyticsService } from './analytics.service.js';

const RangeInput = z.object({ from: z.string().optional(), to: z.string().optional() });
const BestSellersQuery = RangeInput.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** Today's date in the store's time zone. */
export function localToday(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

@ApiTags('analytics (back office)')
@Controller('admin/analytics')
@Authenticated('STAFF', 'ADMIN')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Defaults to the last 30 days including today; validated like any other input. */
  private range(input: z.infer<typeof RangeInput>): DateRangeQuery {
    const to = input.to ?? localToday(this.config.ANALYTICS_TIME_ZONE);
    const from = input.from ?? addDays(to, -29);
    return new ZodValidationPipe(DateRangeQuerySchema).transform({ from, to });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Revenue, orders, AOV, refunds; compared with the previous period' })
  summary(
    @Query(new ZodValidationPipe(RangeInput)) query: z.infer<typeof RangeInput>,
  ): Promise<SalesSummary> {
    return this.analytics.summary(this.range(query));
  }

  @Get('daily')
  @ApiOperation({ summary: 'Sales per store-local day (days without sales included)' })
  daily(
    @Query(new ZodValidationPipe(RangeInput)) query: z.infer<typeof RangeInput>,
  ): Promise<DailySales> {
    return this.analytics.daily(this.range(query));
  }

  @Get('best-sellers')
  @ApiOperation({ summary: 'Variants by units sold in paid, not cancelled orders' })
  async bestSellers(
    @Query(new ZodValidationPipe(BestSellersQuery)) query: z.infer<typeof BestSellersQuery>,
  ): Promise<{ currency: string; items: BestSeller[] }> {
    return {
      currency: this.config.ANALYTICS_CURRENCY,
      items: await this.analytics.bestSellers(this.range(query), query.limit),
    };
  }

  @Get('customers/:userId')
  @ApiOperation({ summary: 'Lifetime figures of one customer' })
  customer(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<CustomerStats> {
    return this.analytics.customer(userId);
  }
}
