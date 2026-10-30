import { publicEnv } from './env';

export const siteConfig = {
  name: 'CSE Keyboards',
  shortName: 'CSE',
  tagline: 'Precision-built mechanical keyboards',
  description: 'Mechanical keyboards, switches, keycaps and desk accessories.',
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: 'en_US',
  /**
   * Profiles the business actually owns, for search engines (JSON-LD `sameAs`). Empty until
   * they exist: listing someone else's account as ours would be false. No contact email either
   * until the domain has a mailbox (it has no MX record yet).
   */
  social: [] as readonly string[],
} as const;

export function absoluteUrl(path = '/'): string {
  return new URL(path, siteConfig.url).toString();
}

/** Main navigation; titles come from the dictionary (`t.layout.nav[key]`). */
export const mainNav = [
  { key: 'keyboards', href: '/shop/keyboards' },
  { key: 'switches', href: '/shop/switches' },
  { key: 'keycaps', href: '/shop/keycaps' },
  { key: 'accessories', href: '/shop/accessories' },
  { key: 'configurator', href: '/configurator' },
] as const;
