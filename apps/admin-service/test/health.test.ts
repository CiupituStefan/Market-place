import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';

describe('admin-service health (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(loadConfig({ NODE_ENV: 'test' }))],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live reports the service as alive', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'admin-service' });
  });

  it('GET /health/ready reports readiness', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'admin-service' });
  });
});
