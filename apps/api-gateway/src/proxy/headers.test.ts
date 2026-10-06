import { describe, expect, it } from 'vitest';
import { buildUpstreamRequestHeaders, filterUpstreamResponseHeaders } from './headers.js';

const context = {
  requestId: 'req-1',
  clientIp: '203.0.113.7',
  protocol: 'https',
  host: 'api.csekeyboards.com',
};

describe('buildUpstreamRequestHeaders', () => {
  it('forwards normal headers and sets gateway-owned ones', () => {
    const headers = buildUpstreamRequestHeaders(
      {
        'content-type': 'application/json',
        cookie: 'sid=1',
        'content-length': '12',
        'idempotency-key': 'abc',
        host: 'api.csekeyboards.com',
      },
      context,
    );
    expect(headers).toEqual({
      'content-type': 'application/json',
      cookie: 'sid=1',
      'content-length': '12',
      'idempotency-key': 'abc',
      'x-request-id': 'req-1',
      'x-forwarded-for': '203.0.113.7',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'api.csekeyboards.com',
    });
  });

  it('drops spoofed identity and forwarding headers', () => {
    const headers = buildUpstreamRequestHeaders(
      {
        'x-user-id': 'admin',
        'x-user-roles': 'ADMIN',
        'x-internal-token': 'x',
        'x-forwarded-for': '1.2.3.4',
        forwarded: 'for=1.2.3.4',
        'x-real-ip': '1.2.3.4',
      },
      context,
    );
    expect(headers).not.toHaveProperty('x-user-id');
    expect(headers).not.toHaveProperty('x-user-roles');
    expect(headers).not.toHaveProperty('x-internal-token');
    expect(headers).not.toHaveProperty('forwarded');
    expect(headers).not.toHaveProperty('x-real-ip');
    expect(headers['x-forwarded-for']).toBe('203.0.113.7');
  });

  it("drops the client's trace context (the gateway starts the trace)", () => {
    const headers = buildUpstreamRequestHeaders(
      {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        tracestate: 'vendor=x',
        baggage: 'userId=admin',
        accept: 'application/json',
      },
      context,
    );
    expect(headers).not.toHaveProperty('traceparent');
    expect(headers).not.toHaveProperty('tracestate');
    expect(headers).not.toHaveProperty('baggage');
    expect(headers.accept).toBe('application/json');
  });

  it('drops hop-by-hop headers, including those named in Connection', () => {
    const headers = buildUpstreamRequestHeaders(
      {
        connection: 'keep-alive, x-secret-hop',
        'keep-alive': 'timeout=5',
        'x-secret-hop': '1',
        'transfer-encoding': 'chunked',
        te: 'trailers',
      },
      context,
    );
    expect(Object.keys(headers).sort()).toEqual([
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-request-id',
    ]);
  });
});

describe('filterUpstreamResponseHeaders', () => {
  it('keeps cookies and caching headers but strips hop-by-hop and server details', () => {
    const headers = filterUpstreamResponseHeaders({
      'set-cookie': ['a=1', 'b=2'],
      'cache-control': 'no-store',
      connection: 'close',
      'transfer-encoding': 'chunked',
      'x-powered-by': 'Express',
      server: 'nginx',
      'x-request-id': 'upstream-id',
    });
    expect(headers).toEqual({ 'set-cookie': ['a=1', 'b=2'], 'cache-control': 'no-store' });
  });
});
