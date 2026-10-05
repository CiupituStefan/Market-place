import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Unsubscribe links must keep working for years and need no login, so they are
 * HMAC-signed statements ("this address/account opts out of X") rather than
 * stored tokens. They grant nothing beyond opting out.
 */
const Claim = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('newsletter'), email: z.email() }),
  z.object({ scope: z.literal('order-updates'), userId: z.uuid() }),
]);
export type UnsubscribeClaim = z.infer<typeof Claim>;

const sign = (secret: string, body: string) =>
  createHmac('sha256', secret).update(`unsubscribe.v1.${body}`).digest('base64url');

export function createUnsubscribeToken(secret: string, claim: UnsubscribeClaim): string {
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

/** Returns the claim, or null for anything forged, truncated or malformed. */
export function verifyUnsubscribeToken(secret: string, token: string): UnsubscribeClaim | null {
  const [body, signature, ...rest] = token.split('.');
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(secret, body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = Claim.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
