# ADR-013: Server-priced carts in PostgreSQL, hashed visitor tokens, coupons claimed at order time

- Status: Accepted
- Date: 2026-10-05

## Context

The cart is where shoppers see prices, discounts and shipping, but it is not where money moves.
Rules we must keep: the frontend never decides a price (rule 4), no business logic in the frontend
(rule 10), no overselling (rule 8), no cross-service database access (rule 9). Visitors must be
able to build a cart without an account and keep it when they sign in. Coupons have usage limits
that must hold under concurrent checkouts.

## Decision

1. **The cart stores intents, not prices.** A line is a variant id (or configurator selection)
   and a quantity. Every read re-prices from product-service and checks stock with
   inventory-service over their internal REST APIs; a `unit_price_snapshot` exists only to tell the
   shopper once that a price changed. Unavailable lines stay visible, are excluded from totals and
   block checkout.
2. **PostgreSQL only, no Redis cache for carts (for now).** A cart read is two batched internal
   calls plus a few indexed queries. Caching carts would add an invalidation problem (prices and
   stock change outside the cart) for no measured need. Redis can be added in front of the
   catalog lookups if profiling shows it matters.
3. **Visitor identity is an opaque random token** (256 bits, `HttpOnly`, `SameSite=Lax`, `Secure`
   in production) stored hashed. Signed-in identity is the access token via optional auth; an
   invalid token is a 401, never a silent fallback. The visitor cart merges into the user cart on
   the first request that carries both.
4. **Coupons: validate on read, claim on order.** Applying a code only records it on the cart; it
   is re-evaluated on every read. The use is claimed by order-service at order creation with a
   `SELECT … FOR UPDATE` on the code row, idempotent per order id (`discount_redemptions` PK), and
   released if the order is cancelled or its payment fails. `CHECK (used_count <= usage_limit)` is
   the last line of defence.
5. **Tax** is the VAT contained in VAT-inclusive prices at a configured default rate; checkout
   (Phase 8) recomputes with the destination country.

## Alternatives considered

- **Client-side cart (localStorage) priced at checkout**: no server round-trip, but every displayed
  total would be a guess, merge-on-login and cross-device carts are impossible, and coupon errors
  would appear only at the last step.
- **Cart in Redis only**: fast, but carts are customer data worth keeping, and we would still need
  PostgreSQL for discount codes and redemptions with transactional limits.
- **Signed (JWT) visitor cart cookie containing the lines**: stateless, but cookies grow with the
  cart, contents are client-controlled input on every request, and revocation is impossible.
- **Incrementing coupon usage when applied to a cart**: abandoned carts would burn uses.

## Consequences

- Cart reads depend on product-service being up; if it is down the cart answers 503 (it cannot
  price). inventory-service being down only degrades stock information.
- order-service must call `carts/priced` and `discounts/redeem` inside its checkout flow and
  `discounts/release` on cancellation (Phase 8); Phase 10 may move release to events.
- Prices shown in the cart can still change before payment; order-service re-prices once more
  and the order total is what Stripe charges.
