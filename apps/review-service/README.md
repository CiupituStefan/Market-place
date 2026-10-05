# review-service

Default port: **4008**. Product reviews, ratings, helpfulness votes, reports and moderation.

## Rules

- **Who can review**: signed-in shoppers with a confirmed email, one review per product (editable,
  deletable). Shoppers who paid for the product get a **Verified purchase** badge.
- **Verified purchases** come from order events, never from the request: `OrderCreated` records
  which products a signed-in shopper ordered (variants resolved through product-service),
  `OrderPaid` confirms them (and upgrades a review written before payment settled),
  `OrderCancelled` removes them. Guest orders are skipped.
- **Moderation**: every create and edit is checked; reviews with links, email addresses or phone
  numbers wait as `PENDING`. Reports from 3 different shoppers (`REPORTS_TO_HIDE`) send a published
  review back to moderation. Staff publish, hold or reject (`/reviews/manage`).
- **Votes**: helpful / not helpful, one per shopper (changeable), not on your own review; counters
  are updated atomically.
- **Ratings**: only published reviews count. After every change that affects them, the product's
  full aggregate (average, count, distribution) is announced as `ProductRatingChanged` through the
  outbox; product-service projects it onto the catalog (sorting, listing stars).

## API

Public (`/api/v1/reviews`): `GET ?productId=&sort=helpful|newest|highest|lowest&rating=&verified=1`
(reviews + summary), `GET /mine?productId=`, `POST`, `PATCH /:id`, `DELETE /:id`,
`PUT /:id/vote {vote}`, `POST /:id/report {reason}`.

Back office (`/api/v1/reviews/manage`, STAFF/ADMIN): queue by status (most reported first),
`POST /:id/status {status, note}`.

## Data

`reviews` database: `reviews` (unique per product and shopper), `review_votes`,
`review_reports`, `purchases` (projection), `outbox_events`, `inbox_events`.

## Events

Publishes `ReviewCreated`, `ProductRatingChanged`. Consumes `OrderCreated`, `OrderPaid`,
`OrderCancelled` (`review-service.orders`).

## Commands

```bash
pnpm --filter @market/review-service dev
pnpm --filter @market/review-service test                       # PGlite suites
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres \
  pnpm --filter @market/review-service test                     # + race tests on real PostgreSQL
```
