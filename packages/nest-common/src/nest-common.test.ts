import { getRequestContext } from '@market/logger';
import { DomainError, ErrorCode } from '@market/types';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { configureApp } from './bootstrap.js';
import { HealthModule } from './health/health.module.js';
import { HealthService } from './health/health.service.js';
import { memoryLogger } from './test-utils.js';
import { openApiSchema, ZodValidationPipe } from './validation.js';

const CreateThing = z.object({ name: z.string().min(2), quantity: z.int().positive() });

@Controller('things')
class ThingsController {
  @Get('context')
  context() {
    return { requestId: getRequestContext()?.requestId };
  }

  @Get('domain-error')
  domainError() {
    throw new DomainError(ErrorCode.PRODUCT_OUT_OF_STOCK, 'Product is currently out of stock');
  }

  @Get('http-error')
  httpError() {
    throw new NotFoundException('Thing not found');
  }

  @Get('bad-request')
  badRequest() {
    throw new BadRequestException();
  }

  @Get('crash')
  crash() {
    throw new Error('database password is hunter2');
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(CreateThing)) body: z.infer<typeof CreateThing>) {
    return body;
  }
}

let dbUp = true;

@Module({
  imports: [
    HealthModule.register({
      serviceName: 'test-service',
      checks: () => [
        {
          name: 'database',
          check: () => (dbUp ? Promise.resolve() : Promise.reject(new Error('down'))),
        },
        { name: 'cache', critical: false, check: () => Promise.reject(new Error('down')) },
      ],
    }),
  ],
  controllers: [ThingsController],
})
class TestModule {}

describe('nest-common (integration)', () => {
  let app: INestApplication;
  const { logger, lines } = memoryLogger();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { logger });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('request context', () => {
    it('generates a request id, exposes it to handlers and echoes it', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/things/context').expect(200);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body).toEqual({ requestId: res.headers['x-request-id'] });
    });

    it('keeps a valid inbound request id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/things/context')
        .set('x-request-id', 'abc123')
        .expect(200);
      expect(res.headers['x-request-id']).toBe('abc123');
      expect(res.body).toEqual({ requestId: 'abc123' });
    });

    it('writes a structured access log line', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/things/context')
        .set('x-request-id', 'log-check');
      expect(lines).toContainEqual(
        expect.objectContaining({
          message: 'request completed',
          request_id: 'log-check',
          method: 'GET',
          path: '/api/v1/things/context',
          status: 200,
        }),
      );
    });
  });

  describe('error format', () => {
    it('maps domain errors to their status and code', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/things/domain-error')
        .set('x-request-id', 'req-1')
        .expect(409);
      expect(res.body).toEqual({
        error: {
          code: 'PRODUCT_OUT_OF_STOCK',
          message: 'Product is currently out of stock',
          requestId: 'req-1',
        },
      });
    });

    it('maps Nest HTTP exceptions', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/things/http-error').expect(404);
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Thing not found' });
      await request(app.getHttpServer()).get('/api/v1/things/bad-request').expect(400);
    });

    it('returns the standard body for unknown routes', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Route not found' });
    });

    it('hides internal error details and stack traces', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/things/crash').expect(500);
      expect(res.body.error).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(JSON.stringify(res.body)).not.toContain('at ');
      expect(lines).toContainEqual(
        expect.objectContaining({ message: 'unhandled error', status: 500 }),
      );
    });
  });

  describe('validation', () => {
    it('passes valid bodies through', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/things')
        .send({ name: 'Forge', quantity: 2 })
        .expect(201, { name: 'Forge', quantity: 2 });
    });

    it('rejects invalid bodies with field details', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/things')
        .send({ name: 'F', quantity: -1 })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
        'name',
        'quantity',
      ]);
    });

    it('rejects malformed JSON with the standard format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/things')
        .set('content-type', 'application/json')
        .send('{"name":')
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('derives OpenAPI schemas from Zod', () => {
      expect(openApiSchema(CreateThing)).toMatchObject({
        type: 'object',
        required: ['name', 'quantity'],
        properties: { name: { type: 'string', minLength: 2 } },
      });
    });
  });

  describe('health', () => {
    it('liveness never depends on dependencies', async () => {
      dbUp = false;
      await request(app.getHttpServer())
        .get('/health/live')
        .expect(200, { status: 'ok', service: 'test-service' });
      dbUp = true;
    });

    it('readiness reports checks; non-critical failures do not fail it', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'test-service',
        checks: { database: 'up', cache: 'down' },
      });
    });

    it('readiness fails when a critical dependency is down', async () => {
      dbUp = false;
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(res.body.checks.database).toBe('down');
      dbUp = true;
    });

    it('readiness fails while draining for shutdown', async () => {
      app.get(HealthService).beforeApplicationShutdown();
      await request(app.getHttpServer()).get('/health/ready').expect(503);
    });
  });
});
