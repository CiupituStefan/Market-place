import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token.js';

const secret = 'x'.repeat(40);

describe('unsubscribe tokens', () => {
  it('round-trips a signed claim', () => {
    const claim = { scope: 'order-updates' as const, userId: randomUUID() };
    expect(verifyUnsubscribeToken(secret, createUnsubscribeToken(secret, claim))).toEqual(claim);
  });

  it('rejects tampering, other secrets and garbage', () => {
    const token = createUnsubscribeToken(secret, { scope: 'newsletter', email: 'a@example.com' });
    const [, signature] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ scope: 'newsletter', email: 'victim@example.com' }),
    ).toString('base64url');
    expect(verifyUnsubscribeToken(secret, `${forgedBody}.${signature ?? ''}`)).toBeNull();
    expect(verifyUnsubscribeToken('y'.repeat(40), token)).toBeNull();
    expect(verifyUnsubscribeToken(secret, 'nonsense')).toBeNull();
    expect(verifyUnsubscribeToken(secret, `${token}.extra`)).toBeNull();
  });
});
