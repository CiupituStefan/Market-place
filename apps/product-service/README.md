# product-service

Default port: **4002**

## Responsibilities

- Catalog: products, variants (SKU, price, attributes, images), categories, brands.
- Flexible keyboard attributes (layout, mounting, switches, connectivity, materials, ...).
- Keyboard configurator rules (option groups, compatibility, price deltas, configuration IDs).
- Search (PostgreSQL full-text + trigram first, behind a `SearchProvider` interface so OpenSearch can replace it).
- Image metadata; binaries live in S3 and are served through CloudFront.
- Source of truth for **prices**: other services fetch prices from here and never trust the client.

## Owned data

`products` database: `products`, `product_variants`, `categories`, `product_images`, `product_attributes`.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: `ProductCreated`, `ProductUpdated`
- Consumes: `ReviewCreated` (denormalised rating summary)

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/product-service dev        # watch mode
pnpm --filter @market/product-service test       # unit + integration tests
pnpm --filter @market/product-service build && pnpm --filter @market/product-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
