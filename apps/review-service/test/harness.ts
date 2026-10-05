import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import { createLogger, type Logger } from '@market/logger';
import { configureApp, JwtVerifier } from '@market/nest-common';
import { JWT_AUDIENCE, type Role } from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import type { CatalogGateway, ProductLookup } from '../src/clients/catalog.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';

export function testConfig(): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/reviews',
  });
}

export const silentLogger: Logger = createLogger({
  service: 'review-service',
  destination: new Writable({
    write: (_chunk, _encoding, callback) => {
      callback();
    },
  }),
});

/** In-memory product-service. */
export class FakeCatalog implements CatalogGateway {
  readonly products_ = new Map<string, ProductLookup>();
  readonly variantProduct = new Map<string, string>();

  addProduct(status: ProductLookup['status'] = 'PUBLISHED', variants = 2) {
    const productId = randomUUID();
    this.products_.set(productId, {
      productId,
      slug: `p-${productId.slice(0, 6)}`,
      name: 'Board',
      status,
    });
    const variantIds = Array.from({ length: variants }, () => randomUUID());
    for (const v of variantIds) this.variantProduct.set(v, productId);
    return { productId, variantIds };
  }

  products(productIds: string[]): Promise<ProductLookup[]> {
    return Promise.resolve(productIds.flatMap((id) => this.products_.get(id) ?? []));
  }

  productIdsOfVariants(variantIds: string[]): Promise<Map<string, string>> {
    return Promise.resolve(
      new Map(
        variantIds.flatMap((v) =>
          this.variantProduct.has(v) ? [[v, this.variantProduct.get(v) ?? '']] : [],
        ),
      ),
    );
  }
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  catalog: FakeCatalog;
  /** Signs an access token; `verified: false` simulates an unconfirmed email. */
  token: (userId: string, options?: { roles?: Role[]; verified?: boolean }) => Promise<string>;
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
  const token = (userId: string, options: { roles?: Role[]; verified?: boolean } = {}) =>
    new SignJWT({
      sid: randomUUID(),
      roles: options.roles ?? ['USER'],
      email_verified: options.verified ?? true,
    })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject(userId)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keys.privateKey);

  const catalog = new FakeCatalog();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier, catalog })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, { logger: silentLogger });
  await app.init();
  return {
    app,
    http: app.getHttpServer(),
    db,
    catalog,
    token,
    close: async () => {
      await app.close();
      await close();
    },
  };
}
