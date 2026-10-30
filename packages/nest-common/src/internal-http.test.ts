import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { request } from 'undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInternalDispatcher } from './internal-http.js';

let server: Server;
let port: number;
const dispatcher = createInternalDispatcher();

beforeAll(async () => {
  server = createServer((_req, res) => res.end('ok'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await dispatcher.close();
  await new Promise((resolve) => server.close(resolve));
});

describe('createInternalDispatcher', () => {
  it('reaches a service by name over IPv4, and again from the cached lookup', async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(`http://localhost:${String(port)}/`, { dispatcher });
      expect(response.statusCode).toBe(200);
      expect(await response.body.text()).toBe('ok');
    }
  });
});
