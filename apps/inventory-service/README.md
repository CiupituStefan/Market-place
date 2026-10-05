# inventory-service

Default port: **4003**. Stock levels, checkout reservations and the stock ledger. Its one job is to
make overselling impossible.

## How overselling is prevented

1. **Row locks in a global order.** A reservation locks every affected `inventory` row with
   `SELECT … FOR UPDATE`, sorted by variant id, checks availability on the locked rows, then
   increments `reserved`. Concurrent checkouts for the last unit queue on the lock; exactly one wins.
   The fixed order means two orders for {A, B} and {B, A} can never deadlock.
2. **Database invariants.** `CHECK (0 <= reserved <= on_hand)` and `on_hand >= 0`: even a bug in
   application code cannot oversell; the statement fails instead.
3. **Idempotency.** One reservation per `orderId` (unique index); retries return the same
   reservation. Confirm and release are no-ops when repeated.
4. **Expiry.** Unpaid reservations expire after `RESERVATION_TTL_SECONDS` (15 min). The sweeper uses
   `FOR UPDATE SKIP LOCKED`, so every replica can run it without double-releasing.
5. **Late payments.** If a payment arrives after the reservation expired, confirmation sells from
   available stock if any is left; otherwise it fails with `INSUFFICIENT_STOCK` and the order must be
   refunded. It never sells stock that is not there.

These properties are tested against a real PostgreSQL (`test/concurrency.test.ts`): 25 shoppers
for the last unit, 40 orders for 10 units, opposite lock orders, concurrent retries, duplicated
webhooks, parallel sweepers and a payment racing the sweeper. Mutation checks confirmed the tests
fail when the row locks or the lock order are removed.

## Flow

```
order created ──▶ reserve ──(payment succeeded)──▶ confirm: on_hand -= q, reserved -= q
                     │
                     ├──(payment failed / cancelled)──▶ release: reserved -= q
                     └──(TTL elapsed)──────────────────▶ expire:  reserved -= q
```

## API

Back office (`/api/v1/inventory`, STAFF/ADMIN): list (least available first, `lowStock=1`), item,
movements ledger, adjustments (`RECEIVED` / `ADJUSTMENT`, never below what is reserved), low-stock
threshold, reservations by status.

Internal (`/api/v1/internal/...`, not routable through the gateway): `reservations` (create,
201/200 idempotent), `reservations/:id`, `reservations/:id/confirm`, `reservations/:id/release`,
`availability`, `variants/sync` (stock records for catalog variants).

## Data

`inventory` database: `inventory`, `inventory_reservations`, `inventory_reservation_items`,
`stock_movements` (append-only ledger with resulting levels and actor), `outbox_events`.

## Events

`InventoryReserved`, `InventoryReleased`, `InventoryReservationExpired`, `InventoryDecremented`, and
`InventoryStockChanged` for every level change (product-service projects it into catalog
availability). Consumes `ProductCreated` / `ProductUpdated` (`inventory-service.catalog`): every
catalog variant gets a stock record at zero, exactly once.

## Commands

```bash
pnpm --filter @market/inventory-service dev
pnpm --filter @market/inventory-service test                       # PGlite suites
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres \
  pnpm --filter @market/inventory-service test                     # + concurrency suite
pnpm --filter @market/inventory-service build && pnpm --filter @market/inventory-service seed   # needs product-service running
```
