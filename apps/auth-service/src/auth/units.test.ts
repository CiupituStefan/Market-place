import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashOpaqueToken } from '../tokens/opaque-token.js';
import { SigningKeys } from '../tokens/signing-keys.js';
import { LoginSchema, RegisterSchema } from './dto.js';
import { hashPassword, needsRehash, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('hashes with Argon2id and verifies', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it('flags weaker or foreign hashes for upgrade and never throws on garbage', async () => {
    expect(needsRehash('$argon2id$v=19$m=4096,t=3,p=1$abc$def')).toBe(true);
    expect(needsRehash('$2b$10$bcrypt-hash')).toBe(true);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('opaque tokens', () => {
  it('are 256-bit, URL-safe and stored as SHA-256', () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateOpaqueToken()).not.toBe(token);
    expect(hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });
});

describe('DTOs', () => {
  it('normalises emails and enforces the password policy', () => {
    expect(LoginSchema.parse({ email: ' A@B.CO ', password: 'x' }).email).toBe('a@b.co');
    const tooShort = RegisterSchema.safeParse({
      email: 'a@b.co',
      password: 'short',
      firstName: 'A',
      lastName: 'B',
    });
    expect(tooShort.success).toBe(false);
    const sameAsEmail = RegisterSchema.safeParse({
      email: 'longaddress@example.com',
      password: 'LongAddress@example.com',
      firstName: 'A',
      lastName: 'B',
    });
    expect(sameAsEmail.success).toBe(false);
  });
});

describe('SigningKeys', () => {
  it('loads a configured PEM (raw or base64) and exposes only public material', async () => {
    const { generateKeyPair, exportPKCS8, exportSPKI } = await import('jose');
    const current = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
    const previous = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
    const pkcs8 = await exportPKCS8(current.privateKey);
    const keys = await SigningKeys.load({
      privateKeyPem: Buffer.from(pkcs8).toString('base64'),
      keyId: 'k2',
      previousPublicKeyPem: await exportSPKI(previous.publicKey),
      previousKeyId: 'k1',
      issuer: 'cse-auth',
    });
    expect(keys.ephemeral).toBe(false);
    expect(keys.jwks.keys.map((k) => k.kid)).toEqual(['k2', 'k1']);
    for (const key of keys.jwks.keys) expect(key).not.toHaveProperty('d');
  });
});
