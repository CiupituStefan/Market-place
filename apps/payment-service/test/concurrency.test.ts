import { randomUUID } from 'node:crypto';
import { createPostgresTestDatabase } from '@market/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { payments, refunds } from '../src/db/schema.js';
import { PaymentService } from '../src/payments/payment.service.js';
import { MockProvider } from '../src/provider/mock.provider.js';
import { FakeOrders, orderOf, testConfig, WEBHOOK_SECRET } from './harness.js';

/** Races that need real row locks. Needs TEST_DATABASE_URL; CI provides one. */
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('concurrency on real PostgreSQL', () => {
  let db: Database;
  let close: () => Promise<void>;
  let service: PaymentService;
  const provider = new MockProvider(WEBHOOK_SECRET);
  const orders = new FakeOrders();

  beforeAll(async () => {
    ({ db, close } = await createPostgresTestDatabase({
      adminUrl: adminUrl!,
      schema,
      migrationsFolder: MIGRATIONS_FOLDER,
      maxConnections: 30,
    }));
    service = new PaymentService(db, testConfig(), provider, orders);
  });

  afterAll(async () => {
    await close();
  });

  const viewerFor = (userId: string) => ({ userId, roles: [], orderToken: null, cartToken: null });

  it('creates a single intent for 20 simultaneous pay clicks', async () => {
    const userId = randomUUID();
    const order = orders.add(orderOf(50_00), userId);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => service.session(order.id, viewerFor(userId))),
    );
    const secrets = new Set(
      results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.clientSecret] : [])),
    );
    expect(secrets.size).toBe(1);
    expect(await db.select().from(payments).where(eq(payments.orderId, order.id))).toHaveLength(1);
  });

  it('never refunds more than was paid, whatever the concurrency', async () => {
    const userId = randomUUID();
    const order = orders.add(orderOf(100_00), userId);
    const { clientSecret, paymentId } = await service.session(order.id, viewerFor(userId));
    const event = provider.confirm(clientSecret, 'succeed');
    await service.handleWebhook(event.rawBody, event.signature);

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        service.refund(paymentId, { amount: 20_00, reason: 'requested_by_customer' }, 'staff'),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const [row] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(row).toMatchObject({ refundedAmount: 100_00, status: 'REFUNDED' });
    expect(await db.select().from(refunds).where(eq(refunds.paymentId, paymentId))).toHaveLength(5);
  });
});
