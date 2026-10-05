# review-service

Default port: **4008**

## Responsibilities

- Product reviews with 1–5 rating, verified-purchase flag, moderation status.
- Helpfulness votes (one per user per review).
- Rating aggregates per product.

## Owned data

`reviews` database: `reviews`, `review_votes`, `purchased_products` (projection built from `OrderPaid`).

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: `ReviewCreated`
- Consumes: `OrderPaid` (verified purchase projection)

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/review-service dev        # watch mode
pnpm --filter @market/review-service test       # unit + integration tests
pnpm --filter @market/review-service build && pnpm --filter @market/review-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
