import type { Server } from 'node:http';

/**
 * How long an idle keep-alive connection stays open. It must outlive the load balancer's idle
 * timeout (ALB: 60 s): otherwise Node closes a connection the load balancer is about to reuse,
 * and that request fails with a 502. Node's default is 5 s.
 */
export const KEEP_ALIVE_TIMEOUT_MS = 65_000;

/** Keep-alive settings for a service's HTTP server, applied before it listens. */
export function tuneHttpServer(server: Server): void {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  // Must exceed keepAliveTimeout, or Node may cut a reused connection while headers arrive.
  server.headersTimeout = KEEP_ALIVE_TIMEOUT_MS + 1_000;
}
