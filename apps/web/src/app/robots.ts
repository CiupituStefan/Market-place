import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

const PRIVATE = [
  '/account',
  '/cart',
  '/checkout',
  '/wishlist',
  '/search',
  '/reset-password',
  '/verify-email',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private and per-visitor pages, in both languages (Romanian under /ro).
        disallow: ['/admin', '/api/', ...PRIVATE.flatMap((path) => [path, `/ro${path}`])],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
