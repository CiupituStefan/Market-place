import { Writable } from 'node:stream';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { createTestDatabase } from '@market/db/testing';
import { createLogger } from '@market/logger';
import { configureApp, JwtVerifier, setupOpenApi } from '@market/nest-common';
import { JWT_AUDIENCE, type Role } from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { AppModule } from '../src/app.module.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import type { ObjectStorage } from '../src/images/object-storage.js';
import { seedCatalog } from '../src/seed/seed.js';

/** In-memory stand-in for S3: tracks which keys were "uploaded". */
export class FakeStorage implements ObjectStorage {
  readonly uploaded = new Set<string>();
  readonly deleted: string[] = [];

  presignUpload(key: string, contentType: string, maxBytes: number) {
    return Promise.resolve({
      url: 'https://bucket.s3.test',
      fields: { key, 'Content-Type': contentType, policy: `max=${maxBytes}` },
      key,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
  }

  exists(key: string) {
    return Promise.resolve(this.uploaded.has(key));
  }

  delete(key: string) {
    this.deleted.push(key);
    return Promise.resolve();
  }
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  config: AppConfig;
  storage: FakeStorage;
  token: (roles: Role[]) => Promise<string>;
  close: () => Promise<void>;
}

export async function createHarness(options: { seed?: boolean } = {}): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/products',
    ASSET_BASE_URL: 'https://cdn.csekeyboards.test',
  });
  const { db, close } = await createTestDatabase({
    schema,
    migrationsFolder: MIGRATIONS_FOLDER,
    extensions: { pg_trgm },
  });
  if (options.seed ?? true) await seedCatalog(db, config);

  const keys = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'EdDSA' };
  const verifier = new JwtVerifier(createLocalJWKSet({ keys: [jwk] }), {
    issuer: config.JWT_ISSUER,
  });
  const signingKey: CryptoKey = keys.privateKey;
  const token = (roles: Role[]) =>
    new SignJWT({ sid: '5a2d8c3e-1b4f-4e6a-8c7d-2f9e0a1b3c4d', roles, email_verified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject('0b7c1f0e-4f2a-4d8e-9a43-3c1f6f1c9a10')
      .setIssuer(config.JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(signingKey);

  const storage = new FakeStorage();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier, storage })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const silent = createLogger({
    service: 'product-service',
    destination: new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  });
  configureApp(app, { logger: silent });
  setupOpenApi(app, { title: 'product-service' });
  await app.init();
  return {
    app,
    http: app.getHttpServer(),
    db,
    config,
    storage,
    token,
    close: async () => {
      await app.close();
      await close();
    },
  };
}
