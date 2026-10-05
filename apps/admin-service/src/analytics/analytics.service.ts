import type {
  BestSeller,
  CustomerStats,
  DailySales,
  DateRangeQuery,
  SalesSummary,
} from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lt, ne, sql, sum, type SQL } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { salesLines, salesOrders, salesRefunds } from '../db/schema.js';

const DAY_MS = 86_400_000;

/** `sum()` and `count()` come back as strings or numbers depending on the driver. */
const int = (value: unknown) => Math.round(Number(value ?? 0));

/** Adds days to a YYYY-MM-DD date (calendar arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Reporting over the sales read model. Days are store-local: a range of dates
 * becomes [local midnight of `from`, local midnight after `to`), computed by
 * PostgreSQL so daylight-saving changes are handled correctly.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Local midnight of `date` as an absolute instant. */
  private startOf(date: string): SQL {
    return sql`(${date}::date::timestamp AT TIME ZONE ${this.config.ANALYTICS_TIME_ZONE})`;
  }

  private localDay(column: SQL | typeof salesOrders.paidAt): SQL<string> {
    return sql<string>`to_char(${column} AT TIME ZONE ${this.config.ANALYTICS_TIME_ZONE}, 'YYYY-MM-DD')`;
  }

  private inRange(
    column:
      typeof salesOrders.paidAt | typeof salesRefunds.refundedAt | typeof salesOrders.cancelledAt,
    range: DateRangeQuery,
  ): SQL | undefined {
    return and(
      gte(column, this.startOf(range.from)),
      lt(column, this.startOf(addDays(range.to, 1))),
    );
  }

  private get currency() {
    return this.config.ANALYTICS_CURRENCY;
  }

  async summary(range: DateRangeQuery): Promise<SalesSummary> {
    const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1;
    const previousRange = { from: addDays(range.from, -days), to: addDays(range.from, -1) };
    const [current, previous, [awaiting]] = await Promise.all([
      this.figures(range),
      this.figures(previousRange),
      this.db
        .select({ value: count() })
        .from(salesOrders)
        .where(
          and(eq(salesOrders.status, 'PENDING_PAYMENT'), eq(salesOrders.currency, this.currency)),
        ),
    ]);
    return {
      ...current,
      from: range.from,
      to: range.to,
      currency: this.currency,
      timeZone: this.config.ANALYTICS_TIME_ZONE,
      previous,
      awaitingPayment: int(awaiting?.value),
    };
  }

  private async figures(range: DateRangeQuery) {
    const currency = eq(salesOrders.currency, this.currency);
    const [[paid], [refunds], [cancelled]] = await Promise.all([
      this.db
        .select({
          gross: sum(salesOrders.total),
          discounts: sum(salesOrders.discount),
          orders: count(),
        })
        .from(salesOrders)
        .where(
          and(eq(salesOrders.wasPaid, true), currency, this.inRange(salesOrders.paidAt, range)),
        ),
      this.db
        .select({ amount: sum(salesRefunds.amount) })
        .from(salesRefunds)
        .where(
          and(
            eq(salesRefunds.currency, this.currency),
            this.inRange(salesRefunds.refundedAt, range),
          ),
        ),
      this.db
        .select({ orders: count() })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.status, 'CANCELLED'),
            currency,
            this.inRange(salesOrders.cancelledAt, range),
          ),
        ),
    ]);
    const grossSales = int(paid?.gross);
    const paidOrders = int(paid?.orders);
    const refunded = int(refunds?.amount);
    return {
      grossSales,
      refunds: refunded,
      netSales: grossSales - refunded,
      paidOrders,
      averageOrderValue: paidOrders > 0 ? Math.round(grossSales / paidOrders) : 0,
      discounts: int(paid?.discounts),
      cancelledOrders: int(cancelled?.orders),
    };
  }

  /** One entry per local day in the range, days without sales included. */
  async daily(range: DateRangeQuery): Promise<DailySales> {
    const paidDay = this.localDay(salesOrders.paidAt);
    const refundDay = this.localDay(sql`${salesRefunds.refundedAt}`);
    const [sales, refunds] = await Promise.all([
      this.db
        .select({ day: paidDay, gross: sum(salesOrders.total), orders: count() })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.wasPaid, true),
            eq(salesOrders.currency, this.currency),
            this.inRange(salesOrders.paidAt, range),
          ),
        )
        // By position: the parameterised time zone makes the expression unequal to itself.
        .groupBy(sql`1`),
      this.db
        .select({ day: refundDay, amount: sum(salesRefunds.amount) })
        .from(salesRefunds)
        .where(
          and(
            eq(salesRefunds.currency, this.currency),
            this.inRange(salesRefunds.refundedAt, range),
          ),
        )
        .groupBy(sql`1`),
    ]);
    const salesByDay = new Map(sales.map((row) => [row.day, row]));
    const refundsByDay = new Map(refunds.map((row) => [row.day, int(row.amount)]));
    const days: DailySales['days'] = [];
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      const row = salesByDay.get(date);
      days.push({
        date,
        grossSales: int(row?.gross),
        refunds: refundsByDay.get(date) ?? 0,
        paidOrders: int(row?.orders),
      });
    }
    return { currency: this.currency, days };
  }

  /** Units and line revenue (before order-level discounts) of paid, not cancelled orders. */
  async bestSellers(range: DateRangeQuery, limit: number): Promise<BestSeller[]> {
    const units = sum(salesLines.quantity);
    const rows = await this.db
      .select({
        sku: salesLines.sku,
        name: sql<string>`max(${salesLines.name})`,
        variantId: sql<string | null>`(array_agg(${salesLines.variantId}))[1]`,
        units,
        revenue: sql<string>`sum(${salesLines.quantity} * ${salesLines.unitPrice})`,
      })
      .from(salesLines)
      .innerJoin(salesOrders, eq(salesOrders.orderId, salesLines.orderId))
      .where(
        and(
          eq(salesOrders.wasPaid, true),
          ne(salesOrders.status, 'CANCELLED'),
          eq(salesOrders.currency, this.currency),
          this.inRange(salesOrders.paidAt, range),
        ),
      )
      .groupBy(salesLines.sku)
      .orderBy(desc(units), desc(sql`sum(${salesLines.quantity} * ${salesLines.unitPrice})`))
      .limit(limit);
    return rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      variantId: row.variantId,
      units: int(row.units),
      revenue: int(row.revenue),
    }));
  }

  async customer(userId: string): Promise<CustomerStats> {
    const mine = and(
      eq(salesOrders.userId, userId),
      eq(salesOrders.wasPaid, true),
      eq(salesOrders.currency, this.currency),
    );
    const [[orders], [refunds]] = await Promise.all([
      this.db
        .select({
          gross: sum(salesOrders.total),
          orders: count(),
          first: sql<string | null>`min(${salesOrders.paidAt})`,
          last: sql<string | null>`max(${salesOrders.paidAt})`,
        })
        .from(salesOrders)
        .where(mine),
      this.db
        .select({ amount: sum(salesRefunds.amount) })
        .from(salesRefunds)
        .innerJoin(salesOrders, eq(salesOrders.orderId, salesRefunds.orderId))
        .where(mine),
    ]);
    const paidOrders = int(orders?.orders);
    const grossSpent = int(orders?.gross);
    const iso = (value: string | Date | null | undefined) =>
      value ? new Date(value).toISOString() : null;
    return {
      userId,
      currency: this.currency,
      paidOrders,
      grossSpent,
      refunded: int(refunds?.amount),
      averageOrderValue: paidOrders > 0 ? Math.round(grossSpent / paidOrders) : 0,
      firstOrderAt: iso(orders?.first),
      lastOrderAt: iso(orders?.last),
    };
  }
}
