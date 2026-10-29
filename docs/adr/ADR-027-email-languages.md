# ADR-027: Customer emails in the shopper's language

- Status: Accepted
- Date: 2026-10-29

## Context

[ADR-026](ADR-026-storefront-languages.md) made the storefront Romanian for visitors from
Romania and English for everyone else, but every email was still English. Emails start in four
services, and none of them knew the shopper's language:

- auth-service sends account confirmation and password reset;
- order-service's events drive order confirmation, shipping, delivery and cancellation;
- payment-service's events drive failed-payment and refund emails;
- notification-service itself sends the newsletter confirmation and welcome.

## Decision

1. **The email language is the storefront language the shopper used.** Romanian visitors get
   Romanian by default (ADR-026), so Romanian customers get Romanian emails and everyone else
   gets English. A Romanian who switched the site to English gets English emails.
2. **The storefront sends it as `?locale=` on the requests that cause emails:** register,
   forgot password, checkout, newsletter sign-up and the account's newsletter switch.
   - A query parameter rather than a body field, because the bodies are validated strictly.
   - A query parameter rather than a header, because a header would need a CORS change.
   - Servers that do not know the parameter ignore it, so the storefront and the backend can
     be deployed in either order.
3. **It travels with the events:**
   - `NotificationRequested` and `OrderCreated` get an optional `locale`. It is additive and
     optional, so it stays V1: older consumers ignore it, and a missing value means English.
   - notification-service stores the language with each queued email, each order contact and
     each newsletter subscriber. Later emails about an order (shipped, refunded) and later
     newsletters use the stored value.
   - Orders created before this change have no language; their emails are Romanian when they
     ship to Romania or Moldova, otherwise English.
4. **Templates in both languages:**
   - `templates/copy.ts` holds the words (`ro` must have the same shape as `en`, which
     TypeScript checks).
   - Money and dates are formatted for the language.
   - Every link points to the page in that language (`/ro/order/...`, `/ro/unsubscribe`).

## Alternatives considered

- **Language from the shipping country only:** this ignores shoppers who chose English, and
  says nothing for account emails, which have no address.
- **A language column on the user account:** guests, newsletter subscribers and password
  resets have no signed-in user. The language of the request that caused the email covers all
  of them. A per-account preference can still be added later on top of this.

## Consequences

- Every new email needs Romanian copy; the build fails without it.
- Product names in order emails are the names stored on the order (the catalog's English
  names). This is fine for brand names like "CSE Forge 75".
