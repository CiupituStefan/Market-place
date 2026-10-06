import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce } from './csp';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `) || d === name)
    ?.split(' ')
    .slice(1);

describe('buildCsp', () => {
  const production = buildCsp({
    nonce: 'abc123',
    development: false,
    apiUrl: 'https://api.csekeyboards.com/',
    assetUrl: 'https://cdn.csekeyboards.com/products',
    https: true,
  });

  it('runs only nonced scripts and what they load (no inline, no eval)', () => {
    const scripts = directive(production, 'script-src');
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it('allows the API, the image CDN and Stripe, by origin only', () => {
    expect(directive(production, 'connect-src')).toEqual([
      "'self'",
      'https://api.csekeyboards.com',
      'https://api.stripe.com',
      'https://maps.googleapis.com',
    ]);
    expect(directive(production, 'img-src')).toContain('https://cdn.csekeyboards.com');
    expect(directive(production, 'frame-src')).toContain('https://hooks.stripe.com');
  });

  it('cannot be framed, posts forms only to itself, no plugins or base hijack', () => {
    expect(directive(production, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(production, 'form-action')).toEqual(["'self'"]);
    expect(directive(production, 'object-src')).toEqual(["'none'"]);
    expect(directive(production, 'base-uri')).toEqual(["'self'"]);
    expect(production).toContain('upgrade-insecure-requests');
  });

  it('relaxes only what development tooling needs', () => {
    const dev = buildCsp({
      nonce: 'n',
      development: true,
      apiUrl: 'http://localhost:4000',
      https: false,
    });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toEqual(
      expect.arrayContaining(['ws:', 'http://localhost:4000']),
    );
    expect(dev).not.toContain('upgrade-insecure-requests');
  });

  it('does not upgrade requests of a local http:// production build (Docker Compose)', () => {
    const local = buildCsp({
      nonce: 'n',
      development: false,
      apiUrl: 'http://localhost:4000',
      https: false,
    });
    expect(local).not.toContain('upgrade-insecure-requests');
    expect(directive(local, 'script-src')).not.toContain("'unsafe-eval'");
  });

  it('ignores a malformed URL instead of emitting it', () => {
    const csp = buildCsp({ nonce: 'n', development: false, apiUrl: 'not a url', https: true });
    expect(directive(csp, 'connect-src')).not.toContain('not');
  });
});

describe('createNonce', () => {
  it('is fresh and has 128 bits', () => {
    const a = createNonce();
    expect(a).not.toBe(createNonce());
    expect(atob(a)).toHaveLength(16);
  });
});
