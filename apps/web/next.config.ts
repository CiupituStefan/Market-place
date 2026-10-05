import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Product images live in S3 and are served through CloudFront (locally: the S3-compatible
 * store in Docker Compose). The asset base URL is configured per environment; nothing else
 * may be used as an image source.
 */
function assetPattern():
  NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number] | null {
  const raw = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  if (!raw) return null;
  const url = new URL(raw);
  // Plain http only for a store on this machine (Docker Compose); real hosts need TLS.
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) {
    throw new Error('NEXT_PUBLIC_ASSET_BASE_URL must use https outside localhost');
  }
  return {
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    hostname: url.hostname,
    port: url.port,
    pathname: `${url.pathname.replace(/\/$/, '')}/**`,
  };
}
const asset = assetPattern();
/**
 * A store on localhost (Docker Compose) is reachable by the browser but not by the
 * image optimiser running inside the web container, so local images are served as is.
 */
const localAssets = asset?.hostname === 'localhost' || asset?.hostname === '127.0.0.1';

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
    remotePatterns: asset ? [asset] : [],
    unoptimized: localAssets,
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
