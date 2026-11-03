import { createHmac } from 'node:crypto';
import { env } from './env.js';

/**
 * The seeded admin's authenticator (RFC 6238: HMAC-SHA1, 30 s, 6 digits), from the
 * development-only ADMIN_TOTP_SECRET the Compose stack enrols. The server accepts each time
 * step once, so every sign-in takes a step no earlier sign-in in this worker used, waiting
 * for the next one if needed (at most 30 s).
 */
const PERIOD_MS = 30_000;
let lastStep = 0;

function base32Decode(text: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeFor(step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(env.adminTotpSecret)).update(counter).digest();
  const offset = (hmac.at(-1) ?? 0) & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** A code for a step not used before by this worker. */
export async function freshAdminCode(): Promise<string> {
  let step = Math.floor(Date.now() / PERIOD_MS);
  if (step <= lastStep) {
    await new Promise((resolve) =>
      setTimeout(resolve, (lastStep + 1) * PERIOD_MS - Date.now() + 200),
    );
    step = Math.floor(Date.now() / PERIOD_MS);
  }
  lastStep = step;
  return codeFor(step);
}
