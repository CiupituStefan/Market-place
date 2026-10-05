import { Writable } from 'node:stream';
import { createLogger } from '@market/logger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';
import { DEFAULT_POLICIES } from '../src/rate-limit/policies.js';
import { MemoryRateLimitStore } from '../src/rate-limit/store.js';
import { setupGateway } from '../src/setup.js';
import { startFakeUpstream } from './fake-upstream.js';

const SITE = 'https://csekeyboards.test';
const silent = createLogger({
  service: 'api-gateway',
  destination: new Writable({
    write: (_c, _e, cb) => {
      cb();
    },
  }),
});

describe('api-gateway (integration)', () => {
  let app: NestExpressApplication;
  let upstream: Awaited<ReturnType<typeof startFakeUpstream>>;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;

  beforeAll(async () => {
    upstream = await startFakeUpstream();
    const config = loadConfig({
      NODE_ENV: 'test',
      CORS_ORIGINS: SITE,
      MAX_BODY_BYTES: '2048',
      UPSTREAM_TIMEOUT_MS: '300',
      DOCS_ENABLED: 'false',
      AUTH_SERVICE_URL: upstream.url,
      PRODUCT_SERVICE_URL: upstream.url,
      CART_SERVICE_URL: upstream.url,
      ORDER_SERVICE_URL: upstream.url,
      PAYMENT_SERVICE_URL: upstream.url,
      // Nothing listens on port 1: simulates a service that is down.
      REVIEW_SERVICE_URL: 'http://127.0.0.1:1',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule.register(config, {
          rateLimitStore: new MemoryRateLimitStore(),
          rateLimitPolicies: [
            {
              name: 'tight',
              limit: 2,
              windowMs: 60_000,
              matches: (_m, path) => path.startsWith('/api/v1/categories'),
            },
            ...DEFAULT_POLICIES,
          ],
        }),
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    setupGateway(app, config, silent);
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
  });

  describe('routing', () => {
    it('forwards method, path and query unchanged, with a correlation id', async () => {
      const res = await request(http)
        .get('/api/v1/products?category=keyboards&layout=75%25')
        .set('x-request-id', 'abc123')
        .expect(200);
      expect(res.body).toMatchObject({
        method: 'GET',
        url: '/api/v1/products?category=keyboards&layout=75%25',
      });
      expect(res.body.headers['x-request-id']).toBe('abc123');
      expect(res.headers['x-request-id']).toBe('abc123');
    });

    it('generates a request id when the client sends none', async () => {
      const res = await request(http).get('/api/v1/products').expect(200);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.headers['x-request-id']).toBe(res.headers['x-request-id']);
    });

    it('returns the standard 404 body for unknown routes', async () => {
      const res = await request(http).get('/api/v1/unknown').expect(404);
      expect(res.body.error).toMatchObject({
        code: 'NOT_FOUND',
        requestId: res.headers['x-request-id'],
      });
    });

    it('never proxies internal endpoints', async () => {
      await request(http).get('/api/v1/orders/internal/reconcile').expect(404);
    });

    it('passes upstream errors through untouched', async () => {
      const res = await request(http).get('/api/v1/orders/missing').expect(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('headers', () => {
    it('strips spoofed identity headers and sets forwarding headers', async () => {
      const res = await request(http)
        .get('/api/v1/products')
        .set('x-user-id', 'someone-else')
        .set('x-user-roles', 'ADMIN')
        .set('x-forwarded-for', '6.6.6.6')
        .expect(200);
      expect(res.body.headers).not.toHaveProperty('x-user-id');
      expect(res.body.headers).not.toHaveProperty('x-user-roles');
      expect(res.body.headers['x-forwarded-for']).not.toContain('6.6.6.6');
      expect(res.body.headers['x-forwarded-proto']).toBe('http');
    });

    it('relays cookies but not upstream server details', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .set('origin', SITE)
        .send({ email: 'a@b.c' })
        .expect(200);
      expect(res.headers['set-cookie']).toHaveLength(2);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-request-id']).not.toBe('upstream-should-not-leak');
    });

    it('adds security headers', async () => {
      const res = await request(http).get('/api/v1/products').expect(200);
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('bodies', () => {
    it('streams JSON bodies byte-for-byte', async () => {
      const body = JSON.stringify({
        variantId: '00000000-0000-4000-8000-000000000001',
        quantity: 2,
      });
      const res = await request(http)
        .post('/api/v1/cart/items')
        .set('origin', SITE)
        .set('content-type', 'application/json')
        .send(body)
        .expect(200);
      expect(Buffer.from(res.body.bodyBase64, 'base64').toString()).toBe(body);
    });

    it('keeps the Stripe webhook body raw and skips CSRF/rate limits', async () => {
      // Whitespace, number formatting and unicode would all change if anything parsed and
      // re-serialised the body, which would invalidate Stripe's signature.
      const raw = '{ "id" : "evt_1",\n  "amount": 1.50, "note": "Tastatură ⌨ \\u00e9" }';
      const res = await request(http)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 't=1,v1=abc')
        .set('content-type', 'application/json')
        .send(raw)
        .expect(200);
      expect(Buffer.from(res.body.bodyBase64, 'base64').toString('utf8')).toBe(raw);
      expect(res.body.headers['stripe-signature']).toBe('t=1,v1=abc');
    });

    it('rejects bodies over the limit before contacting the upstream', async () => {
      const before = upstream.requests.length;
      const res = await request(http)
        .post('/api/v1/cart/items')
        .set('origin', SITE)
        .set('content-type', 'application/json')
        .send('x'.repeat(4096))
        .expect(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(upstream.requests.length).toBe(before);
    });
  });

  describe('upstream failures', () => {
    it('returns 503 when a service is down', async () => {
      const res = await request(http).get('/api/v1/reviews').expect(503);
      expect(res.body.error).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
    });

    it('returns 504 when a service is too slow', async () => {
      const res = await request(http).get('/api/v1/products/slow').expect(504);
      expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
    });
  });

  describe('CSRF origin check', () => {
    it('blocks cookie-authenticated writes from other origins', async () => {
      const before = upstream.requests.length;
      const res = await request(http)
        .post('/api/v1/cart/items')
        .set('origin', 'https://evil.example')
        .set('cookie', 'access_token=abc')
        .send({})
        .expect(403);
      expect(res.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Cross-site request blocked',
      });
      expect(upstream.requests.length).toBe(before);
    });

    it('blocks cookie-authenticated writes without Origin or Referer', async () => {
      await request(http)
        .delete('/api/v1/cart/items/1')
        .set('cookie', 'access_token=abc')
        .expect(403);
    });

    it('allows reads from anywhere', async () => {
      await request(http).get('/api/v1/products').set('origin', 'https://evil.example').expect(200);
    });
  });

  describe('CORS', () => {
    it('answers preflight for allowed origins with credentials', async () => {
      const res = await request(http)
        .options('/api/v1/cart/items')
        .set('origin', SITE)
        .set('access-control-request-method', 'POST')
        .set('access-control-request-headers', 'content-type')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(SITE);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not grant CORS to other origins', async () => {
      const res = await request(http).get('/api/v1/products').set('origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('rate limiting', () => {
    it('returns 429 with RateLimit headers once the limit is exceeded', async () => {
      const first = await request(http).get('/api/v1/categories').expect(200);
      expect(first.headers['ratelimit-limit']).toBe('2');
      expect(first.headers['ratelimit-remaining']).toBe('1');
      await request(http).get('/api/v1/categories').expect(200);
      const limited = await request(http).get('/api/v1/categories').expect(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('health', () => {
    it('is ready without depending on upstream services', async () => {
      await request(http).get('/health/live').expect(200);
      const res = await request(http).get('/health/ready').expect(200);
      expect(res.body).toEqual({ status: 'ok', service: 'api-gateway', checks: {} });
    });
  });
});
