# ADR-015: Notifications from domain events, a queued delivery log, and SES

- Status: Accepted
- Date: 2026-10-05

## Context

The shop sends account emails (verification, password reset), order emails (confirmation,
shipping, delivery, cancellation, payment failure, refund) and a newsletter. Kafka delivers
events at least once and may replay history; SMTP and SES fail transiently; a customer must never
get two confirmations for one order, and never a link to someone else's data. Marketing email in
the EU needs explicit, provable consent and a working unsubscribe.

## Decision

1. **Who decides what is sent.** Services announce _facts_ (`OrderPaid`, `PaymentRefunded`, ...);
   notification-service decides which email follows. Only auth-service sends an explicit
   `NotificationRequested`, because the single-use link token exists only there.
2. **Local projection instead of synchronous lookups.** `OrderPaid` and `OrderShipped` carry only
   ids; `OrderCreated` is projected into `order_contacts` (email, lines, totals) so later emails
   render without calling order-service (rule 9) and keep working when it is down.
3. **Queue first, send later.** Consumers only insert into `notification_logs` (exactly-once with
   the inbox, unique `notification_key`); a dispatcher sends due rows claimed with
   `FOR UPDATE SKIP LOCKED` (safe with any number of replicas), retries with exponential backoff
   (30 s → 1 h, 8 attempts), and marks permanent rejections `FAILED` at once. A provider outage
   never blocks a Kafka partition.
4. **Preferences are applied when queuing** and recorded as `SUPPRESSED` with a reason.
   Security and transactional emails are always sent; shipping/delivery updates can be turned
   off; the newsletter needs double opt-in.
5. **Stale events are not emailed** (`MAX_EVENT_AGE_HOURS`, 24): a new deployment replaying topic
   history, or a dead letter re-published days later, records but does not mail.
6. **Unsubscribe links are HMAC-signed claims** (scope + email or user id), valid without login
   and forever, granting nothing but opting out. Optional emails carry `List-Unsubscribe` and
   `List-Unsubscribe-Post` (RFC 8058 one-click, required by large mailbox providers).
7. **Providers:** Amazon SES in AWS (managed deliverability, bounce/complaint suppression, IAM role
   credentials — rule 14); SMTP for local Mailpit or a relay; `log` for development and tests,
   refused in production.
8. **Minimal retention of secrets:** template data (which can hold single-use links) is erased
   when an email is sent or suppressed, and seven days after a final failure.

## Alternatives considered

- **Each service sends its own email** — duplicated templates, credentials in every service, no
  single place for preferences and unsubscribes.
- **`NotificationRequested` from every producer** — moves presentation decisions (what the email
  says, whom to tell) into order and payment services, and couples them to template data.
- **Sending inside the consumer** — a slow or failing SMTP server would stall the partition and
  retries would re-run the whole handler; a crash after sending would resend on redelivery.
- **A hosted marketing platform for the newsletter** — reasonable later; for one monthly email a
  double opt-in table is enough and keeps consent records with us.
- **React Email / MJML** — nicer authoring, but a build step and dependencies for nine simple
  templates. Templates are typed blocks rendered to escaped HTML plus a text part.

## Consequences

- At-least-once at the provider boundary: a crash between the provider's acceptance and marking
  the row `SENT` can resend one email (SES offers no idempotency key). Accepted; it is rare.
- If payment events overtake `OrderCreated` (different topics) the handler fails, the consumer
  retries, and after `CONSUMER_MAX_ATTEMPTS` the event goes to the DLQ to be re-published. In
  practice `OrderCreated` is published minutes before any payment.
- Access tokens now carry an `email` claim (optional, so older tokens still verify) for the
  account newsletter switch.
- SES production access, a verified sending domain (SPF, DKIM, DMARC) and a configuration set
  with bounce/complaint events are provisioned in Phase 16.
