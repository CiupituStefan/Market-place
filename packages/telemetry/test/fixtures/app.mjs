// A tiny ESM app using the instrumented libraries: an inbound HTTP request that calls a
// second endpoint with fetch and logs with pino. Run with --import ../../dist/register.js.
import http from 'node:http';
import net from 'node:net';
import { pino } from 'pino';

const { setHttpRoute } = await import('../../dist/index.js');
// Same redaction as @market/logger: OTLP log export must not bypass it.
const logger = pino({
  messageKey: 'message',
  redact: { paths: ['password'], censor: '[REDACTED]' },
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/downstream') {
    logger.info('downstream handled');
    res.end('ok');
    return;
  }
  // Like the gateway: a catch-all handler naming the route it matched.
  setHttpRoute('/entry/:kind');
  logger.info({ password: 'hunter2-never-logged' }, 'login attempt');
  const { port } = server.address();
  const answer = await fetch(`http://127.0.0.1:${port}/downstream`).then((r) => r.text());
  logger.info({ answer }, 'fixture request handled');
  res.end(answer);
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  await fetch(`http://127.0.0.1:${port}/entry`).then((r) => r.text());
  // A probe as the kubelet sends it (an uninstrumented client): must not produce a span.
  await new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.end('GET /health/live HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
    });
    socket.on('data', () => undefined);
    socket.on('close', resolve);
  });
  server.close();
  const { flushTelemetry } = await import('../../dist/index.js');
  await flushTelemetry();
});
