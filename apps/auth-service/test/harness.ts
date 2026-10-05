import { Writable } from 'node:stream';
import { createLogger } from '@market/logger';
import { configureApp, setupOpenApi } from '@market/nest-common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule, JWKS_PATH } from '../src/app.module.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import type { Database } from '../src/db/database.js';
import { SigningKeys } from '../src/tokens/signing-keys.js';
import { createTestDatabase } from './test-db.js';

export interface Harness {
  app: INestApplication;
  db: Database;
  keys: SigningKeys;
  config: AppConfig;
  close: () => Promise<void>;
}

/** Full auth-service on an in-process Postgres with real migrations. */
export async function createHarness(env: Record<string, string> = {}): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/auth',
    LOGIN_MAX_FAILURES: '3',
    REFRESH_REUSE_GRACE_SECONDS: '0',
    ...env,
  });
  const { db, close } = await createTestDatabase();
  const keys = await SigningKeys.load({ keyId: 'test-key', issuer: config.JWT_ISSUER });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, keys })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const silent = createLogger({
    service: 'auth-service',
    destination: new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  });
  configureApp(app, { logger: silent, excludeFromPrefix: [JWKS_PATH] });
  setupOpenApi(app, { title: 'auth-service' });
  await app.init();
  return {
    app,
    db,
    keys,
    config,
    close: async () => {
      await app.close();
      await close();
    },
  };
}

/** Extracts `name=value` pairs from Set-Cookie headers. */
export function cookiesFrom(
  setCookie: string[] | string | undefined,
): Record<string, { value: string; attributes: string }> {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return Object.fromEntries(
    list.map((cookie) => {
      const [pair = '', ...rest] = cookie.split(';');
      const index = pair.indexOf('=');
      return [
        pair.slice(0, index),
        { value: pair.slice(index + 1), attributes: rest.join(';').trim() },
      ];
    }),
  );
}
