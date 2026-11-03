import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  SecretBox,
  timeStep,
  totpCode,
  verifyTotp,
} from './totp.js';

/** RFC 6238 Appendix B: SHA-1 seed "12345678901234567890"; we use the last 6 of the 8 digits. */
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
const at = (seconds: number) => new Date(seconds * 1000);

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC test vectors', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totpCode(RFC_SECRET, timeStep(at(59)))).toBe('287082');
    expect(totpCode(RFC_SECRET, timeStep(at(1_111_111_109)))).toBe('081804');
    expect(totpCode(RFC_SECRET, timeStep(at(1_234_567_890)))).toBe('005924');
    expect(totpCode(RFC_SECRET, timeStep(at(2_000_000_000)))).toBe('279037');
  });

  it('accepts one step of clock drift either way, nothing further', () => {
    const now = at(1_234_567_890);
    const step = timeStep(now);
    for (const drift of [-1, 0, 1]) {
      expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + drift), { at: now })).toBe(
        step + drift,
      );
    }
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), { at: now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), { at: now })).toBeNull();
  });

  it('refuses a code from an already used step (replay)', () => {
    const now = at(1_234_567_890);
    const step = timeStep(now);
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { at: now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { at: now, lastUsedStep: step - 1 })).toBe(step);
  });

  it('rejects malformed codes without throwing', () => {
    for (const code of ['', '12345', '1234567', 'abcdef', '12 345']) {
      expect(verifyTotp(RFC_SECRET, code)).toBeNull();
    }
  });

  it('round-trips base32 and makes 160-bit secrets', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Decode('gezd gnbv-gy3t qojq')).toEqual(base32Decode('GEZDGNBVGY3TQOJQ'));
    expect(() => base32Decode('not base32!')).toThrow();
  });

  it('builds the otpauth URI authenticator apps import', () => {
    const uri = new URL(otpauthUri('JBSWY3DPEHPK3PXP', 'a@b.co', 'CSE Keyboards'));
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.host).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toBe('/CSE Keyboards:a@b.co');
    expect(Object.fromEntries(uri.searchParams)).toEqual({
      secret: 'JBSWY3DPEHPK3PXP',
      issuer: 'CSE Keyboards',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
  });
});

describe('recovery codes', () => {
  it('are ten distinct, readable, single-format codes, hashed after normalising', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-km-np-z2-9]{5}-[a-km-np-z2-9]{5}$/);
    const [first] = codes;
    expect(hashRecoveryCode(` ${first!.toUpperCase()} `)).toBe(hashRecoveryCode(first!));
    expect(hashRecoveryCode(first!)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('SecretBox', () => {
  it('encrypts with a fresh IV and authenticates', () => {
    const box = new SecretBox('test key material');
    const sealed = box.seal('JBSWY3DPEHPK3PXP');
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(box.seal('JBSWY3DPEHPK3PXP')).not.toBe(sealed);
    expect(box.open(sealed)).toBe('JBSWY3DPEHPK3PXP');
    expect(() => new SecretBox('another key').open(sealed)).toThrow();
    const [v, iv, tag, data] = sealed.split('.');
    const tampered = [v, iv, tag, `${data!.slice(0, -2)}AA`].join('.');
    expect(() => box.open(tampered)).toThrow();
  });
});
