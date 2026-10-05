import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import { createLogger } from '@market/logger';
import { configureApp, JwtVerifier } from '@market/nest-common';
import { JWT_AUDIENCE, type Role } from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { ReservationService } from '../src/reservations/reservation.service.js';
import { StockService } from '../src/stock/stock.service.js';

export function testConfig(): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/inventory',
    EXPIRY_WORKER_ENABLED: 'false',
  });
}

/** Creates stock records with the given on-hand quantities; returns their variant ids. */
export async function stockUp(stock: StockService, quantities: number[]): Promise<string[]> {
  const variants = quantities.map((_, i) => ({
    variantId: randomUUID(),
    sku: `TEST-${randomUUID().slice(0, 8).toUpperCase()}-${i}`,
  }));
  await stock.syncVariants(variants);
  for (const [i, variant] of variants.entries()) {
    const quantity = quantities[i] ?? 0;
    if (quantity > 0)
      await stock.adjust(
        variant.variantId,
        { type: 'RECEIVED', delta: quantity, reason: 'test stock' },
        'test',
      );
  }
  return variants.map((v) => v.variantId);
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  stock: StockService;
  reservations: ReservationService;
  token: (roles: Role[]) => Promise<string>;
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
  const token = (roles: Role[]) =>
    new SignJWT({ sid: randomUUID(), roles, email_verified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject('0b7c1f0e-4f2a-4d8e-9a43-3c1f6f1c9a10')
      .setIssuer(config.JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keys.privateKey);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, {
    logger: createLogger({
      service: 'inventory-service',
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
    stock: app.get(StockService),
    reservations: app.get(ReservationService),
    token,
    close: async () => {
      await app.close();
      await close();
    },
  };
}
