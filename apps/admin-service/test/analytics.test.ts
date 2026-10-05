import { randomUUID } from 'node:crypto';
import { OrderCancelledV1, OrderCreatedV1, OrderPaidV1, PaymentRefundedV1 } from '@market/events';
import type { BestSeller, CustomerStats, DailySales, SalesSummary } from '@market/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localToday } from '../src/analytics/analytics.controller.js';
import { addDays } from '../src/analytics/analytics.service.js';
import { createHarness, type Harness } from './harness.js';

const eur = (amount: number) => ({ amount, currency: 'EUR' as const });

describe('admin-service analytics', () => {
  let h: Harness;
  let staff: string;
  const customer = randomUUID();

  /** Creates (and optionally pays) an order; returns its id. Times are UTC instants. */
  async function order(options: {
    total: number;
    lines: { sku: string; quantity: number; unitPrice: number }[];
    createdAt: string;
    paidAt?: string;
    userId?: string | null;
    discount?: number;
  }) {
    const orderId = randomUUID();
    const orderNumber = `CSE-${String(Math.floor(Math.random() * 1e6))}`;
    await h.deliver(
      OrderCreatedV1,
      {
        orderId,
        orderNumber,
        userId: options.userId ?? null,
        email: 'Buyer@Example.com',
        lines: options.lines.map((line) => ({
          kind: 'variant' as const,
          variantId: randomUUID(),
          configurationId: null,
          sku: line.sku,
          name: `Product ${line.sku}`,
          quantity: line.quantity,
          unitPrice: eur(line.unitPrice),
        })),
        shippingCountry: 'RO',
        couponCode: null,
        subtotal: eur(options.total),
        discount: eur(options.discount ?? 0),
        shipping: eur(0),
        tax: eur(Math.round(options.total * 0.16)),
        total: eur(options.total),
      },
      orderId,
      new Date(options.createdAt),
    );
    if (options.paidAt) await pay(orderId, orderNumber, options.total, options.paidAt);
    return { orderId, orderNumber };
  }

  const pay = (orderId: string, orderNumber: string, total: number, paidAt: string) =>
    h.deliver(
      OrderPaidV1,
      {
        orderId,
        orderNumber,
        paymentId: randomUUID(),
        reservationId: null,
        cartId: null,
        total: eur(total),
        paidAt,
      },
      orderId,
      new Date(paidAt),
    );

  const get = async <T>(path: string, auth = staff) =>
    (await request(h.http).get(path).set('Authorization', auth).expect(200)).body as T;

  beforeAll(async () => {
    h = await createHarness();
    staff = `Bearer ${await h.token(['STAFF'])}`;

    // March 2026 (Bucharest is UTC+2 until the DST change on 29 March).
    await order({
      total: 10_000,
      lines: [{ sku: 'BOARD-A', quantity: 1, unitPrice: 10_000 }],
      createdAt: '2026-03-01T09:00:00Z',
      paidAt: '2026-03-01T09:05:00Z',
      userId: customer,
      discount: 1_000,
    });
    // 22:30 UTC on 1 March is 00:30 on 2 March in Bucharest.
    await order({
      total: 30_000,
      lines: [
        { sku: 'BOARD-A', quantity: 2, unitPrice: 12_000 },
        { sku: 'KEYCAPS', quantity: 1, unitPrice: 6_000 },
      ],
      createdAt: '2026-03-01T22:20:00Z',
      paidAt: '2026-03-01T22:30:00Z',
      userId: customer,
    });
    // Paid, then cancelled (out of stock) and fully refunded the next day.
    const refunded = await order({
      total: 5_000,
      lines: [{ sku: 'SWITCHES', quantity: 5, unitPrice: 1_000 }],
      createdAt: '2026-03-02T08:00:00Z',
      paidAt: '2026-03-02T08:01:00Z',
    });
    await h.deliver(
      OrderCancelledV1,
      {
        orderId: refunded.orderId,
        orderNumber: refunded.orderNumber,
        reservationId: null,
        reason: 'OUT_OF_STOCK',
        refundRequired: true,
      },
      refunded.orderId,
      new Date('2026-03-02T10:00:00Z'),
    );
    await h.deliver(
      PaymentRefundedV1,
      {
        paymentId: randomUUID(),
        orderId: refunded.orderId,
        stripePaymentIntentId: 'pi_1',
        amount: eur(5_000),
        refundId: randomUUID(),
        stripeRefundId: 're_1',
        refunded: eur(5_000),
        totalRefunded: eur(5_000),
        isFullRefund: true,
      },
      refunded.orderId,
      new Date('2026-03-03T09:00:00Z'),
    );
    // Never paid: neither revenue nor best seller.
    await order({
      total: 99_000,
      lines: [{ sku: 'UNPAID', quantity: 9, unitPrice: 11_000 }],
      createdAt: '2026-03-02T12:00:00Z',
    });
    // The previous period (last days of February).
    await order({
      total: 8_000,
      lines: [{ sku: 'KEYCAPS', quantity: 1, unitPrice: 8_000 }],
      createdAt: '2026-02-27T10:00:00Z',
      paidAt: '2026-02-27T10:00:00Z',
    });
  });

  afterAll(async () => {
    await h.close();
  });

  it('summarises gross, refunds, net and AOV, against the previous period', async () => {
    const summary = await get<SalesSummary>(
      '/api/v1/admin/analytics/summary?from=2026-03-01&to=2026-03-03',
    );
    expect(summary).toMatchObject({
      currency: 'EUR',
      timeZone: 'Europe/Bucharest',
      grossSales: 45_000,
      refunds: 5_000,
      netSales: 40_000,
      paidOrders: 3,
      averageOrderValue: 15_000,
      discounts: 1_000,
      cancelledOrders: 1,
      awaitingPayment: 1,
      previous: { grossSales: 8_000, paidOrders: 1, averageOrderValue: 8_000 },
    });
  });

  it('buckets sales by store-local day, filling empty days', async () => {
    const daily = await get<DailySales>(
      '/api/v1/admin/analytics/daily?from=2026-03-01&to=2026-03-04',
    );
    expect(daily.days).toEqual([
      { date: '2026-03-01', grossSales: 10_000, refunds: 0, paidOrders: 1 },
      // The 22:30 UTC payment belongs to 2 March in Bucharest.
      { date: '2026-03-02', grossSales: 35_000, refunds: 0, paidOrders: 2 },
      { date: '2026-03-03', grossSales: 0, refunds: 5_000, paidOrders: 0 },
      { date: '2026-03-04', grossSales: 0, refunds: 0, paidOrders: 0 },
    ]);
  });

  it('ranks best sellers by units, excluding unpaid and cancelled orders', async () => {
    const { items } = await get<{ items: BestSeller[] }>(
      '/api/v1/admin/analytics/best-sellers?from=2026-03-01&to=2026-03-31&limit=5',
    );
    expect(items.map((i) => [i.sku, i.units, i.revenue])).toEqual([
      ['BOARD-A', 3, 34_000],
      ['KEYCAPS', 1, 6_000],
    ]);
  });

  it('reports a customer’s lifetime figures', async () => {
    const stats = await get<CustomerStats>(`/api/v1/admin/analytics/customers/${customer}`);
    expect(stats).toMatchObject({
      paidOrders: 2,
      grossSpent: 40_000,
      refunded: 0,
      averageOrderValue: 20_000,
      firstOrderAt: '2026-03-01T09:05:00.000Z',
      lastOrderAt: '2026-03-01T22:30:00.000Z',
    });
  });

  it('is idempotent: replayed facts change nothing', async () => {
    const before = await get<SalesSummary>(
      '/api/v1/admin/analytics/summary?from=2026-03-01&to=2026-03-03',
    );
    const { orderId, orderNumber } = await order({
      total: 1_000,
      lines: [{ sku: 'X', quantity: 1, unitPrice: 1_000 }],
      createdAt: '2026-01-10T10:00:00Z',
      paidAt: '2026-03-02T10:00:00Z',
    });
    // The same payment announced twice (two events, same facts).
    await pay(orderId, orderNumber, 1_000, '2026-03-02T10:00:00Z');
    const after = await get<SalesSummary>(
      '/api/v1/admin/analytics/summary?from=2026-03-01&to=2026-03-03',
    );
    expect(after.grossSales - before.grossSales).toBe(1_000);
    expect(after.paidOrders - before.paidOrders).toBe(1);
  });

  it('defaults to the last 30 days and validates ranges', async () => {
    const summary = await get<SalesSummary>('/api/v1/admin/analytics/summary');
    expect(summary.to).toBe(localToday('Europe/Bucharest'));
    expect(summary.from).toBe(addDays(summary.to, -29));
    await request(h.http)
      .get('/api/v1/admin/analytics/summary?from=2026-03-05&to=2026-03-01')
      .set('Authorization', staff)
      .expect(400);
    await request(h.http)
      .get('/api/v1/admin/analytics/daily?from=2024-01-01&to=2026-03-01')
      .set('Authorization', staff)
      .expect(400);
  });

  it('is for staff only', async () => {
    await request(h.http).get('/api/v1/admin/analytics/summary').expect(401);
    await request(h.http)
      .get('/api/v1/admin/analytics/summary')
      .set('Authorization', `Bearer ${await h.token(['USER'])}`)
      .expect(403);
  });
});
