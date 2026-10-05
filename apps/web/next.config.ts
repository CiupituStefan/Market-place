import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Product images live in S3 and are served through CloudFront. The CDN host is
 * configured per environment; nothing else may be used as an image source.
 */
const assetHost = process.env.NEXT_PUBLIC_ASSET_HOST;

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    // Payment is allowed for Stripe's Payment Request button (Apple/Google Pay).
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  // A nonce-based Content-Security-Policy is added in the security hardening phase,
  // once the Stripe and analytics origins are final.
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@market/types'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: assetHost ? [{ protocol: 'https', hostname: assetHost }] : [],
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
