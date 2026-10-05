import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './origin.js';

const allowed = new Set(['https://csekeyboards.com']);
const check = (input: Partial<Parameters<typeof isOriginAllowed>[0]>) =>
  isOriginAllowed(
    { method: 'POST', origin: undefined, referer: undefined, hasCookies: true, ...input },
    allowed,
  );

describe('isOriginAllowed (CSRF)', () => {
  it('always allows safe methods', () => {
    expect(check({ method: 'GET', origin: 'https://evil.example' })).toBe(true);
  });

  it('allows unsafe requests from an allowed origin', () => {
    expect(check({ origin: 'https://csekeyboards.com' })).toBe(true);
  });

  it('blocks unsafe requests from other origins', () => {
    expect(check({ origin: 'https://evil.example' })).toBe(false);
    expect(check({ origin: 'null' })).toBe(false);
    expect(check({ origin: 'https://csekeyboards.com.evil.example' })).toBe(false);
  });

  it('falls back to the Referer origin', () => {
    expect(check({ referer: 'https://csekeyboards.com/checkout' })).toBe(true);
    expect(check({ referer: 'https://evil.example/csekeyboards.com' })).toBe(false);
    expect(check({ referer: 'not a url' })).toBe(false);
  });

  it('allows header-less requests only when no cookies are attached', () => {
    expect(check({ hasCookies: true })).toBe(false);
    expect(check({ hasCookies: false })).toBe(true);
  });
});
