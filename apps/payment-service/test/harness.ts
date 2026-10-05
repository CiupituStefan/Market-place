import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import { createLogger } from '@market/logger';
import { configureApp, JwtVerifier } from '@market/nest-common';
import {
  DomainError,
  ErrorCode,
  hasAnyRole,
  JWT_AUDIENCE,
  money,
  type Order,
  type Role,
} from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import type { OrdersGateway, PaymentOutcome, Viewer } from '../src/clients/orders.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { MockProvider } from '../src/provider/mock.provider.js';

export const WEBHOOK_SECRET = 'whsec_test_secret_for_tests_only';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/payments',
    PAYMENT_PROVIDER: 'mock',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...overrides,
  });
}

export function orderOf(total: number, overrides: Partial<Order> = {}): Order {
  const address = {
    firstName: 'Ana',
    lastName: 'Pop',
    company: null,
    line1: 'Strada 1',
    line2: null,
    city: 'Cluj',
    postalCode: '400001',
    region: null,
    country: 'RO' as const,
    phone: null,
  };
  const eur = (amount: number) => money(amount, 'EUR');
  return {
    id: randomUUID(),
    number: `CSE-${String(100_000 + Math.floor(Math.random() * 899_999))}`,
    status: 'PENDING_PAYMENT',
    email: 'ana@example.com',
    items: [],
    subtotal: eur(total),
    discount: eur(0),
    shipping: eur(0),
    tax: eur(Math.round((total * 2_100) / 12_100)),
    vatRateBps: 2_100,
    total: eur(total),
    couponCode: null,
    shippingAddress: address,
    billingAddress: address,
    notes: null,
    paymentDueAt: new Date(Date.now() + 1_800_000).toISOString(),
    paidAt: null,
    cancelledAt: null,
    cancelReason: null,
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    shippedAt: null,
    deliveredAt: null,
    history: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** In-memory order-service with the same access rule and idempotent payment calls. */
export class FakeOrders implements OrdersGateway {
  readonly orders = new Map<string, { order: Order; ownerId: string }>();
  readonly succeeded: { orderId: string; paymentId: string; amount: number }[] = [];
  readonly failed: { orderId: string; message: string | null }[] = [];
  readonly refundedCalls: { orderId: string; amount: number; full: boolean }[] = [];
  /** What order-service answers to the next payment confirmations. */
  outcome: PaymentOutcome = 'PAID';
  down = false;

  add(order: Order, ownerId: string): Order {
    this.orders.set(order.id, { order, ownerId });
    return order;
  }

  accessible(orderId: string, viewer: Viewer): Promise<Order> {
    const entry = this.orders.get(orderId);
    if (
      !entry ||
      (entry.ownerId !== viewer.userId && !hasAnyRole(viewer.roles, ['STAFF', 'ADMIN']))
    ) {
      return Promise.reject(new DomainError(ErrorCode.ORDER_NOT_FOUND, 'Order not found'));
    }
    return Promise.resolve(entry.order);
  }

  paymentSucceeded(orderId: string, payment: { paymentId: string; amount: number }) {
    if (this.down) {
      return Promise.reject(
        new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'order-service is unavailable'),
      );
    }
    this.succeeded.push({ orderId, ...payment });
    const entry = this.orders.get(orderId);
    if (entry && this.outcome === 'PAID') entry.order = { ...entry.order, status: 'PAID' };
    return Promise.resolve({ outcome: this.outcome });
  }

  paymentFailed(orderId: string, message: string | null): Promise<void> {
    this.failed.push({ orderId, message });
    return Promise.resolve();
  }

  refunded(orderId: string, refund: { amount: number; full: boolean }): Promise<void> {
    if (this.down) {
      return Promise.reject(
        new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'order-service is unavailable'),
      );
    }
    this.refundedCalls.push({ orderId, amount: refund.amount, full: refund.full });
    return Promise.resolve();
  }
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  provider: MockProvider;
  orders: FakeOrders;
  token: (userId: string, roles?: Role[]) => Promise<string>;
  close: () => Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const config = testConfig();
  const { db, close } = await createTestDatabase({ schema, migrationsFolder: MIGRATIONS_FOLDER });
  const keys = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'EdDSA' };
  const verifier = new JwtVerifier(createLocalJWKSet({ keys: [jwk] }), {
    issuer: config.JWT_ISSUER,
  });
  const token = (userId: string, roles: Role[] = ['USER']) =>
    new SignJWT({ sid: randomUUID(), roles, email_verified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject(userId)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keys.privateKey);

  const provider = new MockProvider(WEBHOOK_SECRET);
  const orders = new FakeOrders();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier, provider, orders })],
  }).compile();
  // rawBody: exactly as in production, so webhook signatures verify over the real bytes.
  const app = moduleRef.createNestApplication({ logger: false, rawBody: true });
  configureApp(app, {
    logger: createLogger({
      service: 'payment-service',
      destination: new Writable({
        write: (_chunk, _encoding, callback) => {
          callback();
        },
      }),
    }),
  });
  await app.init();
  return {
    app,
    http: app.getHttpServer(),
    db,
    provider,
    orders,
    token,
    close: async () => {
      await app.close();
      await close();
    },
  };
}
