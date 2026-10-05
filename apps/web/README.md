# web — CSE Keyboards storefront

Next.js 16 (App Router) storefront and `/admin` back-office shell. Port **3000**.

## Stack

React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui-style components on Radix (`radix-ui`) ·
TanStack Query · Zod · next-themes · Geist fonts (self-hosted, no runtime font requests).

## Structure

```
src/
  app/
    (store)/            storefront routes, shared header/footer layout
      page.tsx          homepage (hero → featured → categories → best sellers → new →
                        configurator → why us → reviews → newsletter)
      shop/, shop/[category]/, search/       URL-driven listing (filters, sort, pagination)
      product/[slug]/   product page (SSG), gallery + zoom, variants, tabs, FAQ, related
      cart/, checkout/, account/…, wishlist/, login/, register/, forgot-password/
      [page]/           static info pages (shipping, returns, about, privacy, terms)
    admin/              back-office shell (own layout, STAFF/ADMIN gate)
    api/health/         Kubernetes probe
    robots.ts, sitemap.ts, opengraph-image.tsx, icon.svg
  components/
    ui/                 shadcn-style primitives (button, sheet, tabs, accordion, …)
    layout/ home/ shop/ product/ cart/ account/ auth/ admin/ seo/
  lib/
    api/                typed fetch client, standard error handling, session/cart queries
    catalog/            Zod read models, URL query parsing, fixture source, variant logic
    seo/                JSON-LD builders, listing canonical/noindex rules
```

## Rules this app follows

- **No business logic in the browser.** Prices, totals, discounts, tax, stock and payment status are
  always computed by backend services; the UI only formats them. Add-to-cart sends
  `{ variantId, quantity }` — never a price.
- **Every API response is parsed with Zod** (`lib/api/client.ts`) and errors follow the shared
  `{ error: { code, message, requestId } }` contract from `@market/types`.
- **Sessions are httpOnly cookies** set by the gateway; no tokens in `localStorage`.
- **Catalog data** currently comes from `lib/catalog/fixture-source.ts`, which emulates the
  product-service API (filters, facets, search, sorting). Phase 5 swaps it for HTTP calls with the
  same signatures. The fixtures are validated against the API schemas in tests.
- **Product imagery**: product photography will be served from S3 through CloudFront via
  `next/image` (`NEXT_PUBLIC_ASSET_BASE_URL`). Until then, `ProductArt` renders original procedural
  SVGs (real keyboard layouts), which the configurator also uses for live previews.

## SEO

Per-page metadata and canonical URLs, Open Graph/Twitter cards, `ProductGroup` + `Offer` and
`BreadcrumbList` JSON-LD (escaped against XSS), `Organization` + `WebSite` search action, sitemap,
robots (private routes disallowed), and `noindex` on filtered listings, search and account pages.

## Performance

Product, category and info pages are statically generated. Keyboard renders are drawn as a few
grouped paths (not hundreds of elements), below-the-fold sections use `content-visibility`, fonts
are self-hosted and the build emits a `standalone` server for small Docker images.

## Commands

```bash
pnpm --filter @market/web dev        # http://localhost:3000
pnpm --filter @market/web test       # Vitest + Testing Library
pnpm --filter @market/web build && pnpm --filter @market/web start
```

Copy `.env.example` to `.env.local` to override URLs. Without a running gateway, catalog pages
work (fixtures) and API-backed areas (cart, account, auth forms) show their error states.
