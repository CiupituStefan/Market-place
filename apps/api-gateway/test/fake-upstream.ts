import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

/**
 * Minimal upstream service: echoes what it received, with a few special paths
 * for timeouts, cookies and large/streamed responses.
 */
export async function startFakeUpstream(): Promise<{
  url: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}> {
  const requests: RecordedRequest[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const recorded = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(recorded);
      const path = (req.url ?? '').split('?')[0];

      if (path === '/api/v1/products/slow') {
        setTimeout(() => res.end('{}'), 1_000);
        return;
      }
      if (path === '/api/v1/auth/login') {
        res.writeHead(200, {
          'content-type': 'application/json',
          'set-cookie': [
            'access_token=abc; HttpOnly; Secure; SameSite=Lax',
            'refresh_token=def; HttpOnly',
          ],
          'x-powered-by': 'Express',
          'x-request-id': 'upstream-should-not-leak',
        });
        res.end('{"ok":true}');
        return;
      }
      if (path === '/api/v1/orders/missing') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              code: 'ORDER_NOT_FOUND',
              message: 'Order not found',
              requestId: String(req.headers['x-request-id']),
            },
          }),
        );
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          method: recorded.method,
          url: recorded.url,
          headers: recorded.headers,
          bodyBase64: recorded.body.toString('base64'),
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
