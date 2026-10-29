import { describe, expect, it } from 'vitest';
import { localizePath, splitLocale } from './config';
import { decideLocale } from './routing';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const visit = (overrides: Partial<Parameters<typeof decideLocale>[0]>) =>
  decideLocale({
    pathname: '/',
    search: '',
    method: 'GET',
    cookie: undefined,
    country: null,
    userAgent: CHROME,
    ...overrides,
  });

describe('locale paths', () => {
  it('prefixes Romanian paths, leaves English and the back office alone', () => {
    expect(localizePath('/', 'ro')).toBe('/ro');
    expect(localizePath('/shop?page=2', 'ro')).toBe('/ro/shop?page=2');
    expect(localizePath('/shop', 'en')).toBe('/shop');
    expect(localizePath('/admin/orders', 'ro')).toBe('/admin/orders');
    expect(localizePath('https://example.com', 'ro')).toBe('https://example.com');
  });

  it('splits the language off a path', () => {
    expect(splitLocale('/ro')).toEqual({ locale: 'ro', path: '/' });
    expect(splitLocale('/ro/product/x')).toEqual({ locale: 'ro', path: '/product/x' });
    expect(splitLocale('/shop')).toEqual({ locale: 'en', path: '/shop' });
    // Only a whole segment counts.
    expect(splitLocale('/robots')).toEqual({ locale: 'en', path: '/robots' });
  });
});

describe('decideLocale', () => {
  it('redirects first-time visitors from Romania and Moldova to Romanian', () => {
    expect(visit({ pathname: '/shop', search: '?q=a', country: 'RO' })).toEqual({
      action: 'redirect',
      to: '/ro/shop?q=a',
    });
    expect(visit({ country: 'md' })).toEqual({ action: 'redirect', to: '/ro' });
  });

  it('serves English to other countries and when the country is unknown', () => {
    expect(visit({ country: 'DE' })).toEqual({ action: 'render', locale: 'en', path: '/' });
    expect(visit({})).toEqual({ action: 'render', locale: 'en', path: '/' });
  });

  it('follows the visitor’s choice over the country', () => {
    expect(visit({ country: 'RO', cookie: 'en' })).toMatchObject({
      action: 'render',
      locale: 'en',
    });
    expect(visit({ country: 'US', cookie: 'ro' })).toEqual({ action: 'redirect', to: '/ro' });
    // An unknown cookie value is ignored.
    expect(visit({ country: 'RO', cookie: 'xx' })).toMatchObject({ action: 'redirect' });
  });

  it('always serves /ro pages in Romanian, whoever asks', () => {
    expect(visit({ pathname: '/ro/shop', country: 'US', cookie: 'en' })).toEqual({
      action: 'render',
      locale: 'ro',
      path: '/shop',
    });
  });

  it('never redirects crawlers, form posts or the back office', () => {
    const googlebot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    expect(visit({ country: 'RO', userAgent: googlebot })).toMatchObject({ action: 'render' });
    expect(visit({ country: 'RO', method: 'POST' })).toMatchObject({ action: 'render' });
    expect(visit({ pathname: '/admin', country: 'RO' })).toMatchObject({
      action: 'render',
      locale: 'en',
    });
    expect(visit({ pathname: '/ro/admin/orders', search: '?s=1' })).toEqual({
      action: 'redirect',
      to: '/admin/orders?s=1',
    });
  });
});
