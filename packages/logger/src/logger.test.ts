import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, resolveRequestId, runWithContext } from './index.js';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, logger: createLogger({ service: 'test-service', destination }) };
}

describe('createLogger', () => {
  it('writes structured JSON with service, level label and message', () => {
    const { lines, logger } = capture();
    logger.info({ orderId: 'o-1' }, 'order created');
    expect(lines[0]).toMatchObject({
      service: 'test-service',
      level: 'info',
      message: 'order created',
      orderId: 'o-1',
    });
    expect(typeof lines[0]!.time).toBe('string');
  });

  it('attaches the request id from the async context', async () => {
    const { lines, logger } = capture();
    await runWithContext({ requestId: 'abc123', userId: 'u-1' }, async () => {
      await Promise.resolve();
      logger.info('inside request');
    });
    logger.info('outside request');
    expect(lines[0]).toMatchObject({ request_id: 'abc123', user_id: 'u-1' });
    expect(lines[1]).not.toHaveProperty('request_id');
  });

  it('redacts secrets', () => {
    const { lines, logger } = capture();
    logger.info(
      {
        user: { email: 'a@b.c', password: 'hunter2' },
        req: { headers: { authorization: 'Bearer x', cookie: 'sid=1' } },
      },
      'login',
    );
    const serialized = JSON.stringify(lines[0]);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('Bearer x');
    expect(serialized).not.toContain('sid=1');
    expect(serialized).toContain('a@b.c');
  });
});

describe('resolveRequestId', () => {
  it('keeps a well-formed inbound id', () => {
    expect(resolveRequestId('abc-123_x.y:z')).toBe('abc-123_x.y:z');
    expect(resolveRequestId(['first', 'second'])).toBe('first');
  });

  it('replaces missing or unsafe ids with a uuid', () => {
    const uuid = /^[0-9a-f-]{36}$/;
    expect(resolveRequestId(undefined)).toMatch(uuid);
    expect(resolveRequestId('evil\nINFO fake log line')).toMatch(uuid);
    expect(resolveRequestId('x'.repeat(200))).toMatch(uuid);
  });
});
