import { publicEnv } from './env';

export const siteConfig = {
  name: 'CSE Keyboards',
  shortName: 'CSE',
  tagline: 'Precision-built mechanical keyboards',
  description:
    'CSE Keyboards builds and curates premium mechanical keyboards, switches, keycaps and desk accessories — tuned, tested and shipped ready to type.',
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: 'en_US',
  supportEmail: 'support@csekeyboards.com',
  social: {
    instagram: 'https://instagram.com/csekeyboards',
    youtube: 'https://youtube.com/@csekeyboards',
    discord: 'https://discord.gg/csekeyboards',
  },
} as const;

export function absoluteUrl(path = '/'): string {
  return new URL(path, siteConfig.url).toString();
}

export const mainNav = [
  { title: 'Keyboards', href: '/shop/keyboards' },
  { title: 'Switches', href: '/shop/switches' },
  { title: 'Keycaps', href: '/shop/keycaps' },
  { title: 'Accessories', href: '/shop/accessories' },
  { title: 'Configurator', href: '/#configurator' },
] as const;
