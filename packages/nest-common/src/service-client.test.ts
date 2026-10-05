import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runWithContext } from '@market/logger';
import { DomainError } from '@market/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createServiceClient } from './service-client.js';

let server: Server;
let base: string;
const seen: { url: string; requestId: string | undefined; body: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => {
      body += c.toString();
    });
    req.on('end', () => {
      seen.push({
        url: req.url ?? '',
        requestId: req.headers['x-request-id'] as string | undefined,
        body,
      });
      const reply = (status: number, payload: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const errorBody = {
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Only 1 left',
          requestId: 'x',
          details: [{ path: 'SKU', message: 'Only 1 left' }],
        },
      };
      switch (req.url ?? '') {
        case '/api/v1/ok':
          reply(200, { value: 42 });
          break;
        case '/api/v1/stock':
          reply(409, errorBody);
          break;
        case '/api/v1/slow':
          setTimeout(() => {
            reply(200, { value: 1 });
          }, 500);
          break;
        case '/api/v1/broken':
          reply(500, { error: 'boom' });
          break;
        default:
          reply(200, { unexpected: true });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('createServiceClient', () => {
  const call = () =>
    createServiceClient({ baseUrl: base, service: 'test-service', timeoutMs: 200 });

  it('calls under /api/v1, propagates the request id and validates the response', async () => {
    const result = await runWithContext({ requestId: 'trace-123' }, () =>
      call()('/ok', { method: 'POST', body: { a: 1 }, schema: z.object({ value: z.number() }) }),
    );
    expect(result).toEqual({ value: 42 });
    expect(seen.at(-1)).toMatchObject({
      url: '/api/v1/ok',
      requestId: 'trace-123',
      body: '{"a":1}',
    });
  });

  it('re-throws domain errors from the other service unchanged', async () => {
    const error = await call()('/stock', { schema: z.unknown() }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'INSUFFICIENT_STOCK', message: 'Only 1 left' });
  });

  it('maps timeouts, 5xx, schema drift and unreachable hosts to SERVICE_UNAVAILABLE', async () => {
    for (const path of ['/slow', '/broken', '/drift']) {
      await expect(call()(path, { schema: z.object({ value: z.number() }) })).rejects.toMatchObject(
        { code: 'SERVICE_UNAVAILABLE' },
      );
    }
    const down = createServiceClient({ baseUrl: 'http://127.0.0.1:1', service: 'down' });
    await expect(down('/x', { schema: z.unknown() })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'down is unavailable',
    });
  });
});
