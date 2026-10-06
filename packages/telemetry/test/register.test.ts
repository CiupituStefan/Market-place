import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * End-to-end check of the preload in a real Node process (native ESM loader, not Vitest's):
 * spans for the inbound request, the outgoing fetch and the request it caused, all in one
 * trace; logs carrying the trace id; everything exported over OTLP. The receiver keeps the raw
 * protobuf bodies; strings (names, attribute values) are visible in them as UTF-8.
 */
const received: Record<string, Buffer[]> = {};
let collector: Server;
let endpoint: string;

beforeAll(async () => {
  collector = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      (received[req.url ?? ''] ??= []).push(Buffer.concat(chunks));
      res.writeHead(200, { 'content-type': 'application/x-protobuf' }).end();
    });
  });
  await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${String((collector.address() as AddressInfo).port)}`;
});

afterAll(() => {
  collector.close();
});

function run(env: Record<string, string>): Promise<string> {
  const cwd = fileURLToPath(new URL('fixtures/', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', '../../dist/register.js', 'app.mjs'], {
      cwd,
      env: { PATH: process.env.PATH ?? '', ...env },
    });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`fixture exited with ${String(code)}:\n${out}`));
    });
  });
}

const text = (path: string) => (received[path] ?? []).map((b) => b.toString('latin1')).join('\n');

describe('register (preload)', () => {
  it('exports traces, logs and metrics for an ESM app over OTLP', async () => {
    const out = await run({
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      OTEL_SERVICE_NAME: 'fixture-service',
      SERVICE_VERSION: 'abc123',
    });

    const traces = text('/v1/traces');
    expect(traces).toContain('fixture-service');
    expect(traces).toContain('abc123');
    expect(traces).toContain('/entry');
    expect(traces).toContain('/downstream');
    // Probes are not traced.
    expect(traces).not.toContain('/health/live');

    // Every log line carries the trace it belongs to, and both lines share one trace.
    const lines = out
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map((l) => JSON.parse(l) as { message: string; trace_id?: string; span_id?: string });
    const entry = lines.find((l) => l.message === 'fixture request handled');
    const downstream = lines.find((l) => l.message === 'downstream handled');
    expect(entry?.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(downstream?.trace_id).toBe(entry?.trace_id);
    expect(downstream?.span_id).not.toBe(entry?.span_id);

    expect(text('/v1/logs')).toContain('fixture request handled');
    // Redaction happens before export: the secret is in neither stdout nor OTLP.
    expect(text('/v1/logs')).toContain('login attempt');
    expect(text('/v1/logs')).not.toContain('hunter2');
    expect(out).not.toContain('hunter2');
    // A handler can name its route: span name and the metrics' http.route.
    expect(traces).toContain('GET /entry/:kind');
    expect(text('/v1/metrics')).toContain('/entry/:kind');
    expect(text('/v1/metrics')).toContain('http.server.request.duration');
  }, 30_000);

  it('does nothing without an endpoint', async () => {
    const before = Object.keys(received).length;
    const out = await run({});
    const line = out.split('\n').find((l) => l.includes('fixture request handled'));
    expect(line).toBeDefined();
    expect(line).not.toContain('trace_id');
    expect(Object.keys(received).length).toBe(before);
  }, 30_000);
});
