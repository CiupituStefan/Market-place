# cart-service

Default port: **4004**

## Responsibilities

- Guest and user carts; add / remove / update quantity; merge guest cart on login.
- Server-side pricing: re-fetches prices from product-service and stock from inventory-service on every read.
- Coupons / discount codes (percentage, fixed, expiry, usage limits) — owned here because the cart computes totals.
- Wishlist.

## Owned data

`cart` database: `carts`, `cart_items`, `discount_codes`, `discount_redemptions`, `wishlist_items`. Redis for hot cart reads.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: —
- Consumes: `OrderPaid` (redeem coupon, clear cart), `ProductUpdated` (invalidate cached prices)

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/cart-service dev        # watch mode
pnpm --filter @market/cart-service test       # unit + integration tests
pnpm --filter @market/cart-service build && pnpm --filter @market/cart-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
