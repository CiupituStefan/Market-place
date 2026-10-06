/**
 * Content-Security-Policy for the storefront and back office. Scripts run only if they carry
 * the per-request nonce (Next.js adds it to its own scripts) or were loaded by such a script
 * ('strict-dynamic', how Stripe.js is loaded). An injected <script> or inline handler does
 * not run, even if some markup ever escaped React's escaping.
 *
 * Third parties are listed per directive (Stripe's documented requirements for the Payment
 * Element and 3-D Secure). Nothing may frame the shop; forms post only to it.
 */
export interface CspOptions {
  nonce: string;
  /** Development: React needs eval for debugging and the HMR socket. */
  development: boolean;
  /** Browser API base, e.g. https://api.csekeyboards.com */
  apiUrl: string;
  /** Product image CDN, e.g. https://cdn.csekeyboards.com */
  assetUrl?: string | undefined;
  /** The site is served over HTTPS (not a local http:// build): upgrade stray http requests. */
  https: boolean;
}

const STRIPE = {
  script: ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://maps.googleapis.com'],
  frame: ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com'],
  connect: ['https://api.stripe.com', 'https://maps.googleapis.com'],
  img: ['https://*.stripe.com'],
};

const origin = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

export function buildCsp(options: CspOptions): string {
  const api = origin(options.apiUrl);
  const assets = origin(options.assetUrl);
  const directives: Record<string, (string | undefined | false)[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${options.nonce}'`,
      "'strict-dynamic'",
      ...STRIPE.script,
      options.development && "'unsafe-eval'",
    ],
    // React style attributes and Stripe Elements' injected styles; styles cannot run code.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', assets, ...STRIPE.img],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      api,
      ...STRIPE.connect,
      options.development && 'ws:',
      options.development && 'wss:',
    ],
    'frame-src': STRIPE.frame,
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) =>
    [name, ...new Set(values.filter((v): v is string => typeof v === 'string'))].join(' '),
  );
  if (options.https) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** 128 random bits, base64: a fresh nonce for every response. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
