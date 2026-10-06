# ADR-025: Playwright end-to-end journeys on the Docker Compose stack

- Status: Accepted
- Date: 2026-10-06

## Context

Every service is tested on its own, and the integration tests use real PostgreSQL, Redis and
Kafka. What no test proved yet is the whole: does a shopper's click reach the cart through the
gateway, does the payment webhook make the order page say **Paid**, does the order event reach
the notification service and become an email? The checkout crosses up to six services, Kafka and
an email server, and a broken environment variable, route or event subscription passes every
unit test.

We need tests of the critical journeys through a real browser and the real stack. They must run
on every pull request without secrets or external services, and must not be flaky.

## Decision

1. **Playwright** (`e2e/`, TypeScript, Chromium; the purchase journey also on a phone
   viewport), against the **Docker Compose** stack: the same images, seeds and configuration
   developers use. `scripts/e2e.sh` starts the stack, waits for the seed jobs and the gateway,
   runs the tests, and collects every service's logs on failure. CI runs it as the `e2e` job.
2. **A few journeys, chosen by what would hurt the business if it broke:**
   - guest checkout and payment;
   - a declined payment, then a retry;
   - server-side prices;
   - the last unit sold once;
   - account registration with email confirmation;
   - fulfilment, with emails and a verified review;
   - the browser's security policies.

   Rules stay proven by the unit and integration tests.

3. **Deterministic by construction:**
   - every test makes its own data: unique emails, and its own stocked product where
     quantities matter;
   - the mock payment provider goes through the real signed-webhook path;
   - emails are read from Mailpit's API;
   - waits target what the user waits for, with no sleeps and no automatic retries.
4. **The page must stay clean:** a CSP violation or an uncaught error fails the journey in
   which it happened.

## Alternatives considered

- **Cypress:** a single browser tab per test makes the two-session journeys awkward (customer
  and back office at once), and there is no first-class API client for arranging data. Playwright
  also ships traces that make CI failures debuggable.
- **Kubernetes (kind) instead of Compose:** closer to production, but much slower to start in CI,
  and the chart is already validated by its own tests. Staging plus the smoke tests cover what is
  specific to the cluster.
- **Running the journeys against staging:** staging takes Stripe test-mode payments and sends
  real emails, and journeys would leave orders and accounts behind. The read-only smoke tests run
  there after each deploy instead.
- **Stripe test mode in CI:** this would need secrets in pull-request workflows (forks cannot
  have them), plus a webhook tunnel. The mock provider exercises the same webhook handling.
  Stripe itself is tested in staging.

## Consequences

- Pull requests take longer: the `e2e` job builds every image (about 15–25 minutes). It runs in
  parallel with the other jobs and is part of the required `CI passed` check.
- UI changes that break roles or labels break tests. This is intended: it is also an
  accessibility regression.
- Adding a journey means a deliberate choice of what is worth an end-to-end test, recorded in
  [testing](../testing.md).
