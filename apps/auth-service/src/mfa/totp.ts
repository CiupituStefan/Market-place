import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP): HMAC-SHA1, 30-second steps,
 * 6 digits — what every authenticator app (Google Authenticator, Microsoft Authenticator,
 * 1Password, Aegis...) expects from an otpauth:// URI.
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted either side of now: tolerates a phone clock that is up to 30 s off. */
const WINDOW = 1;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32Char = (index: number): string => BASE32.charAt(index);

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += base32Char((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += base32Char((value << (5 - bits)) & 31);
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret (the size RFC 4226 recommends for HMAC-SHA1), base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function timeStep(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
}

/** The code for one time step (RFC 4226 §5.3 dynamic truncation). */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hmac.at(-1) ?? 0) & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * The step a code belongs to, or null. A step at or before `lastUsedStep` is refused, so a code
 * seen once (shoulder-surfed, phished, replayed) cannot be used again.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: { at?: Date; lastUsedStep?: number | null } = {},
): number | null {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) return null;
  const now = timeStep(options.at);
  for (let step = now - WINDOW; step <= now + WINDOW; step++) {
    const last = options.lastUsedStep ?? null;
    if (last !== null && step <= last) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** The URI authenticator apps import (usually as a QR code). */
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── recovery codes ───────────────────────────────────────────────────────────

/** Ten single-use codes like `k7d2m-9xq4p`: 50 bits each, no look-alike characters. */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s/g, '');
}

/** Stored as SHA-256: the codes are random (50 bits), so a fast hash is enough. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

// ── secrets at rest ──────────────────────────────────────────────────────────

/**
 * TOTP secrets cannot be hashed (the server needs them to compute codes), so they are encrypted
 * with AES-256-GCM under MFA_ENCRYPTION_KEY: a database dump alone does not give an attacker
 * the second factor. Format: v1.<iv>.<tag>.<ciphertext>, base64url.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(keyMaterial: string) {
    // Any length of configured key material becomes a 256-bit key.
    this.key = createHash('sha256').update(keyMaterial).digest();
  }

  seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  open(sealed: string): string {
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('unknown sealed secret format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
