import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { KEEP_ALIVE_TIMEOUT_MS, tuneHttpServer } from './http-server.js';

describe('tuneHttpServer', () => {
  it('keeps idle connections open longer than the load balancer (ALB: 60 s)', () => {
    const server = createServer();
    tuneHttpServer(server);
    expect(server.keepAliveTimeout).toBe(KEEP_ALIVE_TIMEOUT_MS);
    expect(server.keepAliveTimeout).toBeGreaterThan(60_000);
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });
});
