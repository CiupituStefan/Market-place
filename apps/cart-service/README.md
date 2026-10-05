# cart-service

Default port: **4004**. Carts, discount codes and wishlists. The browser sends intents (variant,
quantity, code); every amount it shows comes from here and is recomputed on every read.

## How the cart stays honest

1. **No client prices.** Request bodies are strict Zod schemas: a `unitPrice` or `total` field is a 400. Prices are read from product-service (`/internal/variants/lookup`, configurator `quote`) on
   every cart read; `unit_price_snapshot` only remembers what the shopper last saw, so a change is
   announced once with a `PRICE_CHANGED` notice.
2. **Stock is advisory here, binding at checkout.** Adding more than inventory-service can sell is a
   409 `INSUFFICIENT_STOCK`; lines that later run short are marked `available: false`, excluded from
   the totals and set `canCheckout: false`. If inventory-service is down the cart still works
   (`availableQuantity: null`); order-service's reservation is the real gate (Phase 8).
3. **Coupons are re-validated on every read** (active, window, usage limit, per-customer limit,
   minimum subtotal). A code that stops qualifying is removed with a `COUPON_REMOVED` notice.
   Claiming a use happens only when an order is created (`/internal/discounts/redeem`), under a row
   lock, idempotent per order id; cancelled/failed orders give the use back (`release`).
4. **Totals** (`src/pricing/pricing.ts`, pure and unit-tested): subtotal of available lines →
   discount (percentage in basis points, half-up; fixed capped at the subtotal) → shipping (free
   at/above `FREE_SHIPPING_THRESHOLD` after discount, else `SHIPPING_FLAT_RATE`) → total. Prices are
   VAT-inclusive; `tax` is the VAT contained in the total (`VAT_RATE_BPS`). Checkout recomputes
   with the destination country.

## Identity

- **Visitors**: a random 256-bit token in the `cse_cart` cookie (`HttpOnly`, `SameSite=Lax`,
  `Secure` in production, 30 days). Only its SHA-256 is stored, so a database leak does not
  expose usable cart tokens. Malformed cookies are ignored.
- **Signed-in users**: the access token (optional auth: a bad or expired token is a 401, never a
  silent fallback to the visitor cart). One cart per user.
- **Merge on sign-in**: the first request carrying both a session and a visitor cookie moves the
  visitor lines into the user cart (quantities add up, capped at 10), deletes the visitor cart and
  clears the cookie.

## API

Public (`/api/v1/cart`, visitors and users; every response is the full cart, `Cache-Control: no-store`):
`GET /cart`, `DELETE /cart`, `POST /cart/items {variantId, quantity}`,
`POST /cart/configurations {configurator, selection, quantity}`,
`PATCH /cart/items/:itemId {quantity}`, `DELETE /cart/items/:itemId`,
`POST /cart/coupon {code}`, `DELETE /cart/coupon`.

Wishlist (`/api/v1/wishlist`, signed in): `GET`, `POST /items {variantId}`, `DELETE /items/:variantId`.

Back office (`/api/v1/discounts`, STAFF/ADMIN): list, create, patch (the code name is immutable;
`usageLimit` cannot drop below uses already made).

Internal (order-service, not routable through the gateway): `POST /internal/carts/priced
{userId | guestToken}`, `POST /internal/carts/:id/clear`, `POST /internal/discounts/redeem
{code, orderId, userId, subtotal}`, `POST /internal/discounts/release {orderId}`.

Limits: 50 lines per cart, 10 per line, 100 wishlist items.

## Data

`cart` database: `carts` (user **or** hashed visitor token), `cart_items` (variant or
configuration line; unique per cart; `CHECK quantity BETWEEN 1 AND 10`), `discount_codes`
(`CHECK used_count <= usage_limit`), `discount_redemptions` (PK `order_id`), `wishlist_items`.

## Events

Consumes `OrderPaid` (`cart-service.orders`): empties the cart the order came from, exactly once
(inbox table in the same transaction). Discount claims stay synchronous (part of the checkout saga).

## Commands

```bash
pnpm --filter @market/cart-service dev
pnpm --filter @market/cart-service test                       # PGlite suites
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres \
  pnpm --filter @market/cart-service test                     # + concurrency suite (usage limits)
pnpm --filter @market/cart-service build && pnpm --filter @market/cart-service seed   # WELCOME10, SWITCHUP15, LAUNCH20
```
