# ADR-026: Romanian and English storefront, chosen by URL, country and the visitor

- Status: Accepted
- Date: 2026-10-29

## Context

The shop sells to the EU from Romania. Until now the storefront spoke English only, which:

- made it a poor fit for Romanian shoppers, its main audience;
- kept it out of Romanian searches ("tastatură mecanică"), which only pages written in
  Romanian can rank for.

We want Romanian visitors to land on Romanian and everyone else to land on English. Each
language must still have its own URLs that search engines can index, and a shared link must
show the same language to everyone. The catalog texts (product descriptions, specs, category
names) live in product-service, so the language also has to reach the API.

## Decision

1. **Two languages, two URL spaces.**
   - English stays at the existing, unprefixed URLs (`/shop`), so no indexed link breaks.
   - Romanian lives under `/ro` (`/ro/shop`).
   - The proxy (`apps/web/src/proxy.ts`) rewrites `/ro/...` to the same page and passes the
     language in a request header. Each page exists once in the code.
   - The back office stays English only: `/ro/admin` redirects to `/admin`.
2. **Who gets which language** (`lib/i18n/routing.ts`, a pure, unit-tested function):
   - A `/ro` URL is always Romanian, and an unprefixed URL is English unless a redirect applies.
   - The redirect to the `/ro` page (a 307, because the answer depends on who asks) happens when
     either:
     - the visitor chose Romanian with the RO/EN switch (stored in the `cse_locale` cookie for
       a year), or
     - the visitor has made no choice and their country is Romania or Moldova. The country comes
       from the edge: `x-vercel-ip-country` on Vercel, `cloudfront-viewer-country` behind
       CloudFront.
   - An explicit choice always wins over the country.
   - Crawlers, link previews and non-GET requests are never redirected.
3. **Search engines see both languages:**
   - every page declares `hreflang` alternates (`en`, `ro`, `x-default` → English);
   - the sitemap lists both URLs of every page;
   - `<html lang>`, Open Graph locale and JSON-LD URLs follow the page's language.
4. **Interface copy in typed dictionaries:**
   - `lib/i18n/messages/en.ts` is the source; `ro.ts` must have the same shape, which
     TypeScript checks, so a missing translation fails the build.
   - The dictionaries hold plural rules ("20 de produse"), validation messages, and API error
     messages by error code.
   - Money, dates and country names are formatted with `Intl` for the locale (`ro-RO`, `en-IE`).
5. **Catalog texts in product-service, as overlays:**
   - `products`, `categories` and `configurators` get a `translations` jsonb column keyed by
     locale (`{ "ro": { "tagline": ..., "specs": ... } }`).
   - Public reads accept `?locale=ro` and overlay the translated fields; anything missing falls
     back to English, and unknown locales are English rather than an error.
   - Prices, variants, SKUs, option values and filter values are the same in every language,
     so carts, orders and links do not depend on it.
   - Translated names and taglines join the search document, also without diacritics, so
     "tastatura" finds "tastatură".
   - The admin API accepts `translations` on products and categories. The demo seed fills in
     Romanian copy and backfills catalogs seeded before this change, without overwriting texts
     an admin set.

## Alternatives considered

- **Language by browser `Accept-Language` instead of the country:** many Romanians use
  English-language browsers and devices. We were asked specifically for the country, and the
  country is what the edge already gives us.
- **Serving a different language at the same URL:** search engines index one version per URL,
  and the same link would show different pages to different people.
- **A translation library (next-intl):** it would bring its own routing and a second middleware.
  Two languages and our existing proxy (CSP nonces, sign-in redirects) are served well by about
  200 lines of our own code, with dictionaries that TypeScript checks.
- **Separate translation tables:** stronger per-field constraints, but every read would need an
  extra join. Translations are always read and written with their row, and Zod validates the
  jsonb on the way in.

## Consequences

- Every new piece of storefront copy needs a Romanian version; the build fails without one.
- Product content is translated by whoever writes it (admin API now, an admin UI field later).
  Untranslated products still show, in English.
- Catalog responses are cached per URL, `?locale=` included.
- The back office remains English. Emails follow the shopper's language since
  [ADR-027](ADR-027-email-languages.md).
