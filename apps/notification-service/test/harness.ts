import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import type { EventDefinition, PayloadOf } from '@market/events';
import { createEvent } from '@market/events';
import { createLogger, type Logger } from '@market/logger';
import { EventProcessor, InMemoryPublisher, type ProcessResult } from '@market/messaging';
import { configureApp, JwtVerifier } from '@market/nest-common';
import { JWT_AUDIENCE, type Role } from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { Dispatcher } from '../src/delivery/dispatcher.js';
import { LogEmailProvider } from '../src/delivery/log.provider.js';
import type { EmailProvider, OutgoingEmail } from '../src/delivery/provider.js';
import { notificationConsumers } from '../src/events/consumers.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { OrderNotifications } from '../src/orders/order-notifications.js';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/notifications',
    DISPATCH_ENABLED: 'false',
    WEB_URL: 'https://shop.test',
    PUBLIC_API_URL: 'https://api.shop.test',
    ...overrides,
  });
}

export const silentLogger: Logger = createLogger({
  service: 'notification-service',
  destination: new Writable({
    write: (_chunk, _encoding, callback) => {
      callback();
    },
  }),
});

/** Log provider that can be told to fail the next sends. */
export class TestEmailProvider implements EmailProvider {
  readonly name = 'test';
  private readonly inner = new LogEmailProvider(undefined, 1_000);
  failures: Error[] = [];

  get sent() {
    return this.inner.sent;
  }

  send(email: OutgoingEmail) {
    const failure = this.failures.shift();
    if (failure) return Promise.reject(failure);
    return this.inner.send(email);
  }

  to(address: string) {
    return this.sent.filter((email) => email.to === address);
  }
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  email: TestEmailProvider;
  dispatcher: Dispatcher;
  token: (
    userId: string,
    options?: { roles?: Role[]; verified?: boolean; email?: string },
  ) => Promise<string>;
  /** Delivers an event through the real consumer pipeline (inbox, DLQ). */
  deliver: <D extends EventDefinition>(
    definition: D,
    payload: PayloadOf<D>,
    aggregateId: string,
    occurredAt?: Date,
  ) => Promise<{ result: ProcessResult; eventId: string }>;
  redeliver: (eventId: string) => Promise<ProcessResult>;
  dlq: InMemoryPublisher;
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
  const token: Harness['token'] = (userId, options = {}) =>
    new SignJWT({
      sid: randomUUID(),
      roles: options.roles ?? ['USER'],
      email_verified: options.verified ?? true,
      ...(options.email ? { email: options.email } : {}),
    })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject(userId)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keys.privateKey);

  const email = new TestEmailProvider();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier, email })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, { logger: silentLogger });
  await app.init();

  const dlq = new InMemoryPublisher();
  const handlers = new OrderNotifications(app.get(NotificationService));
  const consumers = notificationConsumers(handlers);
  const raw = new Map<string, { topic: string; value: string; key: string }>();
  const process = (message: { topic: string; value: string; key: string }) => {
    const definition = consumers.find((c) => c.topics.includes(message.topic as never));
    if (!definition) throw new Error(`no consumer for ${message.topic}`);
    return new EventProcessor(db, dlq, definition, {
      maxAttempts: 1,
      retryDelayMs: 1,
      logger: silentLogger,
    }).process({ ...message, partition: 0, offset: '1', headers: {} });
  };

  return {
    app,
    http: app.getHttpServer(),
    db,
    email,
    dispatcher: app.get(Dispatcher),
    token,
    dlq,
    deliver: async (definition, payload, aggregateId, occurredAt) => {
      const envelope = createEvent(definition, payload, {
        producer: 'test',
        aggregateId,
        correlationId: 'test-correlation',
        ...(occurredAt ? { occurredAt } : {}),
      });
      const message = {
        topic: definition.topic,
        value: JSON.stringify(envelope),
        key: aggregateId,
      };
      raw.set(envelope.eventId, message);
      return { result: await process(message), eventId: envelope.eventId };
    },
    redeliver: (eventId) => {
      const message = raw.get(eventId);
      if (!message) throw new Error('unknown event');
      return process(message);
    },
    close: async () => {
      await app.close();
      await close();
    },
  };
}

export const eur = (amount: number) => ({ amount, currency: 'EUR' as const });

/** A plausible OrderCreated payload. */
export function orderCreated(
  overrides: { orderId?: string; userId?: string | null; email?: string } = {},
) {
  return {
    orderId: overrides.orderId ?? randomUUID(),
    orderNumber: `CSE-${Math.floor(Math.random() * 1e6)}`,
    userId: overrides.userId === undefined ? randomUUID() : overrides.userId,
    email: overrides.email ?? `buyer-${randomUUID().slice(0, 8)}@example.com`,
    lines: [
      {
        kind: 'variant' as const,
        variantId: randomUUID(),
        configurationId: null,
        sku: 'CSE-FORGE75-BLK-YEL',
        name: 'Forge 75 — Black / Gateron Yellow',
        quantity: 2,
        unitPrice: eur(12_999),
      },
    ],
    shippingCountry: 'RO' as const,
    couponCode: 'WELCOME10',
    subtotal: eur(25_998),
    discount: eur(2_600),
    shipping: eur(0),
    tax: eur(3_736),
    total: eur(23_398),
  };
}
