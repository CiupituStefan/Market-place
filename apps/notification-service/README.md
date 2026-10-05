# notification-service

Default port: **4007**

## Responsibilities

- Turns domain events into emails: order confirmation, shipping and delivery updates,
  cancellation, payment failure, refund, plus the account links auth-service requests
  (email verification, password reset).
- Queues every email once per notification key, then delivers it with retries (SES, SMTP or log).
- Newsletter with double opt-in; per-account preferences; signed one-click unsubscribe links.
- Delivery log for the back office, with manual re-send of failed emails.

Design and trade-offs: [ADR-015](../../docs/adr/ADR-015-notifications.md).

## Owned data

`notifications` database:

| Table                      | Purpose                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| `notification_logs`        | one row per email: QUEUED → SENT / FAILED, or SUPPRESSED (with the reason)  |
| `notification_preferences` | per account: shipping/delivery updates on or off                            |
| `newsletter_subscribers`   | PENDING → SUBSCRIBED → UNSUBSCRIBED, confirmation token hash, consent dates |
| `order_contacts`           | projection of `OrderCreated` (email, lines, totals) for later order emails  |
| `inbox_events`             | consumed event ids (exactly-once handlers)                                  |

No other service may access this data store directly.

## Emails

| Template             | Trigger                                          | Category                     |
| -------------------- | ------------------------------------------------ | ---------------------------- |
| `EMAIL_VERIFICATION` | `NotificationRequested` (auth-service)           | security, always sent        |
| `PASSWORD_RESET`     | `NotificationRequested` (auth-service)           | security, always sent        |
| `ORDER_CONFIRMATION` | `OrderPaid` (after Stripe's webhook)             | transactional, always sent   |
| `ORDER_SHIPPED`      | `OrderShipped`                                   | order updates (can opt out)  |
| `ORDER_DELIVERED`    | `OrderDelivered`                                 | order updates (can opt out)  |
| `ORDER_CANCELLED`    | `OrderCancelled` (customer, admin, out of stock) | transactional                |
| `PAYMENT_FAILED`     | first `PaymentFailed` of an order                | transactional                |
| `REFUND_ISSUED`      | `PaymentRefunded` (partial or full)              | transactional                |
| `NEWSLETTER_CONFIRM` | `POST /newsletter/subscriptions`                 | security (consent link)      |
| `NEWSLETTER_WELCOME` | confirmed subscription                           | newsletter (one-click unsub) |

Events older than `MAX_EVENT_AGE_HOURS` (24) are recorded as SUPPRESSED instead of mailed, so
replaying topic history never emails customers about old orders.

## API (through the gateway, `/api/v1`)

| Method & path                               | Auth        | Purpose                                         |
| ------------------------------------------- | ----------- | ----------------------------------------------- |
| `POST /newsletter/subscriptions`            | public      | start double opt-in (always 202, rate limited)  |
| `POST /newsletter/confirm`                  | public      | confirm with the emailed token                  |
| `GET /notifications/preferences`            | signed in   | shipping updates + newsletter state             |
| `PUT /notifications/preferences`            | signed in   | change them                                     |
| `POST /notifications/unsubscribe`           | signed link | storefront page and RFC 8058 one-click          |
| `GET /notifications/manage/logs`            | STAFF/ADMIN | delivery log (filter by status, recipient)      |
| `POST /notifications/manage/logs/:id/retry` | STAFF/ADMIN | re-queue a FAILED email (while its data exists) |

## Configuration

See [`.env.example`](.env.example). Production requires `EMAIL_PROVIDER=ses` (or `smtp`),
`SES_REGION`, and `UNSUBSCRIBE_SECRET` from Secrets Manager; SES credentials come from the pod's
IAM role.

## Development

```bash
pnpm --filter @market/notification-service dev        # watch mode
pnpm --filter @market/notification-service test       # unit + integration (+ real PG with TEST_DATABASE_URL)
pnpm --filter @market/notification-service db:generate
```

With `EMAIL_PROVIDER=log` every email is printed to the service log (links included). With
Mailpit (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`) set
`EMAIL_PROVIDER=smtp SMTP_URL=smtp://localhost:1025` and open http://localhost:8025.

Health probes: `GET /health/live`, `GET /health/ready`.
