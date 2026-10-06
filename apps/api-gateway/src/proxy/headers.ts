import type { IncomingHttpHeaders } from 'node:http';

/** RFC 9110 hop-by-hop headers: meaningful for one connection only, never forwarded. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Identity and routing headers only the gateway may set. Anything a client sends
 * with these names is dropped so it cannot impersonate a user or spoof its IP.
 */
const SPOOFABLE_PREFIXES = ['x-user-', 'x-internal-', 'x-forwarded-'];
const SPOOFABLE = new Set([
  'forwarded',
  'x-real-ip',
  'host',
  'content-length',
  // Trace context is a trust boundary too: the gateway starts the trace (and the
  // instrumentation injects it upstream); clients cannot pick trace IDs or push baggage
  // into internal services.
  'traceparent',
  'tracestate',
  'baggage',
]);

function connectionTokens(headers: IncomingHttpHeaders | Record<string, unknown>): Set<string> {
  const value = headers.connection;
  const raw = Array.isArray(value) ? value.join(',') : typeof value === 'string' ? value : '';
  return new Set(
    raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
}

export interface ForwardContext {
  requestId: string;
  clientIp: string;
  protocol: string;
  host: string | undefined;
}

export function buildUpstreamRequestHeaders(
  incoming: IncomingHttpHeaders,
  context: ForwardContext,
): Record<string, string | string[]> {
  const extraHopByHop = connectionTokens(incoming);
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(incoming)) {
    const key = name.toLowerCase();
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(key) || extraHopByHop.has(key) || SPOOFABLE.has(key)) continue;
    if (SPOOFABLE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    headers[key] = value;
  }
  headers['x-request-id'] = context.requestId;
  headers['x-forwarded-for'] = context.clientIp;
  headers['x-forwarded-proto'] = context.protocol;
  if (context.host) headers['x-forwarded-host'] = context.host;
  // Preserve the body length when known so upstreams can reject oversize bodies early.
  if (typeof incoming['content-length'] === 'string')
    headers['content-length'] = incoming['content-length'];
  return headers;
}

export function filterUpstreamResponseHeaders(
  upstream: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  const extraHopByHop = connectionTokens(upstream);
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(upstream)) {
    const key = name.toLowerCase();
    if (value === undefined || HOP_BY_HOP.has(key) || extraHopByHop.has(key)) continue;
    // The gateway owns these: request id is already set, security headers come from helmet.
    if (key === 'x-request-id' || key === 'x-powered-by' || key === 'server') continue;
    headers[key] = value;
  }
  return headers;
}
