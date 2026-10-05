import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig, upstreamUrl } from './config.js';

describe('api-gateway config', () => {
  it('has development defaults for every upstream', () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(4000);
    expect(upstreamUrl(config, 'payment-service')).toBe('http://localhost:4006');
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(config.DOCS_ENABLED).toBe(true);
  });

  it('disables docs in production unless explicitly enabled', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).DOCS_ENABLED).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', DOCS_ENABLED: 'true' }).DOCS_ENABLED).toBe(true);
  });

  it('accepts in-cluster upstream URLs', () => {
    const config = loadConfig({
      ORDER_SERVICE_URL: 'http://order-service.shop.svc.cluster.local:4005',
    });
    expect(upstreamUrl(config, 'order-service')).toBe(
      'http://order-service.shop.svc.cluster.local:4005',
    );
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(ConfigError);
    expect(() => loadConfig({ REDIS_URL: 'http://not-redis' })).toThrow(ConfigError);
    expect(() => loadConfig({ AUTH_SERVICE_URL: 'ftp://auth' })).toThrow(ConfigError);
  });
});

describe('JWKS location', () => {
  it('defaults to the auth-service upstream', () => {
    expect(loadConfig({ AUTH_SERVICE_URL: 'http://auth-service:4001' }).AUTH_JWKS_URL).toBe(
      'http://auth-service:4001/.well-known/jwks.json',
    );
  });
});
