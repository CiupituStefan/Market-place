# ADR-008: Storefront architecture (Next.js App Router)

- Status: Accepted
- Date: 2026-10-05

## Context

The storefront must be fast (Core Web Vitals), indexable (product and category pages are the main
acquisition channel), accessible, and must not contain business logic. Backend services are built
incrementally, so the frontend needs a stable data contract before they exist.

## Decision

1. **Server Components by default.** Catalog pages render on the server; client components are
   limited to interaction (variant picker, gallery, filters, forms). Product, category and content
   pages are statically generated; `?variant=` is read on the client so product pages stay static.
2. **The URL is the filter state.** Filters, sort and pagination live in search params, parsed by
   a forgiving Zod schema (invalid values fall back to defaults). Filter links work without JS.
   Only unfiltered listings are indexable; everything else is `noindex` with a canonical URL.
3. **Contract-first data layer.** `lib/catalog/schemas.ts` defines the read models product-service
   will return. A fixture source implements the same functions until Phase 5; tests validate
   fixtures against the schemas so the swap is mechanical.
4. **Server state through TanStack Query** for browser-side calls (cart, session, mutations).
   No global client store: the server is the source of truth.
5. **shadcn/ui pattern** (owned component code on top of Radix) with a CSS-variable token system in
   OKLCH, light/dark via `next-themes`. Brand identity: warm paper neutrals, graphite ink,
   anodised-copper accent, Geist Sans/Mono.
6. **Procedural product art** (inline SVG from real key layouts) as the image fallback and the
   configurator preview renderer. Keys are batched into a few `<path>` elements per color to keep
   HTML and RSC payloads small.

## Alternatives considered

- **Client-rendered SPA**: worse SEO and LCP for product pages. Rejected.
- **Mocking the API with MSW during development**: adds a moving part to every dev session; the
  fixture source is simpler and also powers static builds before the backend exists.
- **Global store (Redux/Zustand)** for cart: duplicates server state; TanStack Query suffices.

## Consequences

- Pages that depend on unbuilt services (cart, account) render real empty/error/sign-in states now
  and start working when the services ship, without UI rewrites.
- Client-side role checks in `/admin` are UX only; enforcement is server-side (gateway + services),
  added with authentication in Phase 4 (including a request `proxy` redirect for `/admin`).
