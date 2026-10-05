import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import { createEvent, type EventDefinition, type PayloadOf } from '@market/events';
import { createLogger, type Logger } from '@market/logger';
import { EventProcessor, InMemoryPublisher, type ProcessResult } from '@market/messaging';
import { configureApp, JwtVerifier } from '@market/nest-common';
import { JWT_AUDIENCE, type Role } from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { SalesProjection } from '../src/analytics/projection.js';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { adminConsumers } from '../src/events/consumers.js';

export const silentLogger: Logger = createLogger({
  service: 'admin-service',
  destination: new Writable({
    write: (_chunk, _encoding, callback) => {
      callback();
    },
  }),
});

export interface Harness {
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  token: (roles?: Role[]) => Promise<string>;
  deliver: <D extends EventDefinition>(
    definition: D,
    payload: PayloadOf<D>,
    aggregateId: string,
    occurredAt: Date,
  ) => Promise<ProcessResult>;
  close: () => Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/admin',
  });
  const { db, close } = await createTestDatabase({ schema, migrationsFolder: MIGRATIONS_FOLDER });
  const keys = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'EdDSA' };
  const verifier = new JwtVerifier(createLocalJWKSet({ keys: [jwk] }), {
    issuer: config.JWT_ISSUER,
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, { logger: silentLogger });
  await app.init();

  const consumers = adminConsumers(new SalesProjection());
  const dlq = new InMemoryPublisher();
  return {
    http: app.getHttpServer(),
    db,
    token: (roles = ['STAFF']) =>
      new SignJWT({ sid: randomUUID(), roles, email_verified: true })
        .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
        .setSubject(randomUUID())
        .setIssuer(config.JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(keys.privateKey),
    deliver: (definition, payload, aggregateId, occurredAt) => {
      const envelope = createEvent(definition, payload, {
        producer: 'test',
        aggregateId,
        correlationId: 'test',
        occurredAt,
      });
      const consumer = consumers.find((c) => c.topics.includes(definition.topic as never));
      if (!consumer) throw new Error(`no consumer for ${definition.topic}`);
      return new EventProcessor(db, dlq, consumer, {
        maxAttempts: 1,
        retryDelayMs: 1,
        logger: silentLogger,
      }).process({
        topic: definition.topic,
        partition: 0,
        offset: '1',
        key: aggregateId,
        value: JSON.stringify(envelope),
        headers: {},
      });
    },
    close: async () => {
      await app.close();
      await close();
    },
  };
}
