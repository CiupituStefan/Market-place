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
  service: 'inventory-service',
  destination: new Writable({
    write: (_chunk, _encoding, callback) => {
      callback();
    },
  }),
});

describe('inventory-service (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(loadConfig({ NODE_ENV: 'test' }))],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { logger: silent });
    setupOpenApi(app, { title: 'inventory-service' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes liveness and readiness probes', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok', service: 'inventory-service' });
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'inventory-service' });
  });

  it('answers unknown API routes with the standard error body', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'req-1')
      .expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), requestId: 'req-1' },
    });
  });

  it('publishes its OpenAPI document for the gateway', async () => {
    const res = await request(app.getHttpServer()).get('/openapi.json').expect(200);
    expect(res.body).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: { title: 'inventory-service' },
    });
  });
});
