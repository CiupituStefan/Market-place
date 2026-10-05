# product-service

Default port: **4002**. Catalog, prices, search and the keyboard configurator. The single source of
truth for prices: cart and order services re-price every line from here.

## Public API (`/api/v1`, cacheable: `Cache-Control: public, max-age=60`)

| Method | Path                               | Notes                                                                  |
| ------ | ---------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/products`                        | Filters, facets, sort, pagination, search (`q`) — see below            |
| GET    | `/products/:slug`                  | Published product with variants, options, specs, images                |
| GET    | `/products/:slug/related`          | Same category first                                                    |
| GET    | `/categories`, `/categories/:slug` | Tree via `parentSlug`                                                  |
| GET    | `/configurator/:slug`              | Groups, options, surcharges, incompatibilities, default selection      |
| POST   | `/configurator/:slug/quote`        | Validates a selection; returns price, breakdown, SKU, configuration id |

`GET /products` query: `q`, `category`, `sort` (`featured`, `newest`, `price-asc`, `price-desc`,
`rating`), `page`, `pageSize` (≤ 100), `inStock`, `minPrice`/`maxPrice` (major units), and the
filters `brand`, `layout`, `switchType`, `connection`, `mount`, `profile`, `material`
(comma-separated or repeated; OR within a filter, AND across filters). The schema is shared with the
storefront (`CatalogQuerySchema` in `@market/types`).

## Back-office API (STAFF / ADMIN)

| Method            | Path                                       | Notes                                           |
| ----------------- | ------------------------------------------ | ----------------------------------------------- |
| GET               | `/products/manage`, `/products/manage/:id` | Every status                                    |
| POST              | `/products`                                | Creates a DRAFT with variants                   |
| PATCH             | `/products/:id`                            | Partial; never resets omitted fields            |
| DELETE            | `/products/:id`                            | ADMIN only; archives (kept for orders)          |
| POST              | `/products/:id/publish`, `/unpublish`      |                                                 |
| POST/PATCH/DELETE | `/products/:id/variants[/:variantId]`      | Price, compare-at, availability                 |
| POST              | `/products/:id/images/upload-url`          | Pre-signed S3 POST (type + size enforced by S3) |
| POST/DELETE       | `/products/:id/images[/:imageId]`          | Register an uploaded object / remove            |
| POST/PATCH        | `/categories[/:id]`                        |                                                 |

## Internal API (not routable through the gateway)

`POST /api/v1/internal/variants/lookup` — current price, SKU, availability and product status for a
list of variant ids (used by cart and order services).

## Search

PostgreSQL full-text (`simple` config, prefix matching) over a denormalised search document (name,
brand, tagline, categories, SKUs, attribute values), plus `pg_trgm` word similarity for typos and an
escaped substring match for exact SKUs. Facet counts ignore their own selection. All of it sits
behind the `CatalogSearch` interface (ADR-011) so OpenSearch can replace it.

## Data

`products` database: `categories`, `products`, `product_variants`, `product_images`,
`product_attributes`, `configurators`, `configurator_options`, `configurator_incompatibilities`,
`outbox_events`. Prices are integer minor units with CHECK constraints (non-negative, compare-at
above price). `availability` and ratings are projections fed by inventory and review events.

## Events

`ProductCreated` and `ProductUpdated` (with variant snapshots and `changedFields`) through the
transactional outbox.

## Commands

```bash
pnpm --filter @market/product-service dev             # migrates on start in development
pnpm --filter @market/product-service test            # PGlite + pg_trgm, real migrations, seeded catalog
pnpm --filter @market/product-service build && pnpm --filter @market/product-service seed   # demo catalog
pnpm --filter @market/product-service db:generate     # after editing src/db/schema.ts
```
