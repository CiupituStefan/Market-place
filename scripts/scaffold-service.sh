#!/usr/bin/env bash
# Scaffolds a NestJS microservice skeleton under apps/<name>.
# Usage: scripts/scaffold-service.sh <service-name> "<one-line description>"
# Existing files are never overwritten, so it is safe to re-run.
set -euo pipefail

NAME="${1:?service name required, e.g. order-service}"
DESCRIPTION="${2:?description required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/apps/$NAME"

PORT="$(node -e "
  const src = require('fs').readFileSync('$ROOT/packages/config/src/services.ts', 'utf8');
  const m = src.match(/'$NAME': \{ port: (\d+) \}/);
  if (!m) { console.error('No port registered for $NAME in packages/config/src/services.ts'); process.exit(1); }
  console.log(m[1]);
")"

write() {
  local path="$DIR/$1"
  mkdir -p "$(dirname "$path")"
  if [[ -e "$path" ]]; then echo "skip  $1"; cat >/dev/null; return; fi
  cat >"$path"
  echo "write $1"
}

write package.json <<EOF
{
  "name": "@market/$NAME",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "$DESCRIPTION",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "nest start --watch --preserveWatchOutput",
    "start": "node dist/main.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo coverage"
  },
  "dependencies": {
    "@market/config": "workspace:*",
    "@market/events": "workspace:*",
    "@market/logger": "workspace:*",
    "@market/nest-common": "workspace:*",
    "@market/types": "workspace:*",
    "@nestjs/common": "^12.1.2",
    "@nestjs/core": "^12.1.2",
    "@nestjs/platform-express": "^12.1.2",
    "@nestjs/swagger": "^12.0.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@market/eslint-config": "workspace:*",
    "@market/tsconfig": "workspace:*",
    "@nestjs/cli": "^12.0.8",
    "@nestjs/testing": "^12.1.2",
    "@swc/core": "^1.16.13",
    "@types/express": "^5.0.6",
    "@types/node": "^22.19.0",
    "@types/supertest": "^7.2.1",
    "eslint": "^10.12.0",
    "supertest": "^7.3.1",
    "typescript": "~6.0.3",
    "unplugin-swc": "^2.0.0",
    "vitest": "^5.0.3"
  }
}
EOF

write tsconfig.json <<'EOF'
{
  "extends": "@market/tsconfig/nestjs.json",
  "compilerOptions": {
    "rootDir": "."
  },
  "include": ["src", "test", "*.config.ts"]
}
EOF

write tsconfig.build.json <<'EOF'
{
  "extends": "@market/tsconfig/nestjs.json",
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
EOF

write nest-cli.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "tsConfigPath": "tsconfig.build.json",
    "deleteOutDir": true
  }
}
EOF

write eslint.config.js <<'EOF'
import { node } from '@market/eslint-config/node';

export default node({ tsconfigRootDir: import.meta.dirname, nest: true });
EOF

write vitest.config.ts <<'EOF'
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS dependency injection needs decorator metadata, which only SWC/tsc emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['reflect-metadata'],
  },
});
EOF

write .env.example <<EOF
# Copy to .env for local development. Never commit real values.
NODE_ENV=development
PORT=$PORT
LOG_LEVEL=debug
EOF

write src/config.ts <<EOF
import { baseServiceEnv, loadEnv, SERVICES } from '@market/config';
import { z } from 'zod';

export const SERVICE_NAME = '$NAME';

// Service-specific variables (database, Kafka, ...) are added here as the service grows.
export const ConfigSchema = baseServiceEnv.extend({
  PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
});
export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
EOF

write src/app.module.ts <<'EOF'
import { HealthModule } from '@market/nest-common';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      // Readiness checks for owned dependencies (database, Kafka) are added with them.
      imports: [HealthModule.register({ serviceName: SERVICE_NAME })],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
EOF

write src/main.ts <<'EOF'
import 'reflect-metadata';
import { runMain, startService } from '@market/nest-common';
import { AppModule } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';

runMain(SERVICE_NAME, async () => {
  const config = loadConfig();
  await startService({
    serviceName: SERVICE_NAME,
    module: AppModule.register(config),
    config,
    openApi: { title: SERVICE_NAME },
    configure: { bodyLimit: '1mb' },
  });
});
EOF

write test/app.test.ts <<EOF
import { Writable } from 'node:stream';
import { createLogger } from '@market/logger';
import { configureApp, setupOpenApi } from '@market/nest-common';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';

const silent = createLogger({
  service: '$NAME',
  destination: new Writable({ write: (_chunk, _encoding, callback) => {
      callback();
    } }),
});

describe('$NAME (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(loadConfig({ NODE_ENV: 'test' }))],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { logger: silent });
    setupOpenApi(app, { title: '$NAME' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes liveness and readiness probes', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok', service: '$NAME' });
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: '$NAME' });
  });

  it('answers unknown API routes with the standard error body', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'req-1')
      .expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String), requestId: 'req-1' } });
  });

  it('publishes its OpenAPI document for the gateway', async () => {
    const res = await request(app.getHttpServer()).get('/openapi.json').expect(200);
    expect(res.body).toMatchObject({ openapi: expect.stringMatching(/^3\./), info: { title: '$NAME' } });
  });
});
EOF

write src/config.test.ts <<EOF
import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('$NAME config', () => {
  it('defaults to the registered port', () => {
    expect(loadConfig({}).PORT).toBe($PORT);
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(ConfigError);
  });
});
EOF
