# Testing

What is tested where, and why at that level. Decision: [ADR-025](adr/ADR-025-end-to-end-testing.md).

| Level          | Where                                                | Runs against                                         | Catches                                                                                     |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Unit           | `*.test.ts` next to the code (Vitest)                | nothing external                                     | pricing, tax, state machines, validation, moderation, templates, CSP building               |
| Integration    | `apps/*/test`, `packages/*/test` (Vitest, Supertest) | real PostgreSQL, Redis, Kafka                        | overselling under concurrency, deadlocks, `SKIP LOCKED`, outbox → Kafka → inbox, migrations |
| Contract       | `packages/events` (Zod schemas, versioned)           | nothing external                                     | a producer and consumer disagreeing about an event                                          |
| Infrastructure | `infrastructure/*/check.sh`, `kafka/test.sh`         | rendered manifests, mock providers, a real broker    | broken charts, policies that admit bad pods, IAM/ACLs wider than intended                   |
| **End-to-end** | `e2e/` (Playwright)                                  | the whole shop in Docker Compose, a real Chromium    | the journeys a shopper and the back office depend on, across every service, Kafka and email |
| Smoke          | `scripts/smoke-test.sh`                              | staging and production after each deploy (read-only) | a deploy that does not answer, misroutes, or leaks errors                                   |

Business rules are proven at the lowest level that can prove them; end-to-end tests prove that
the pieces are wired together and that the critical journeys work for a real user. There are
few of them on purpose: each is slow and touches everything.

## End-to-end journeys

| Spec                 | Journey                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checkout.spec.ts`   | A guest browses the keyboards, buys one, pays, sees **Paid** (only after the signed webhook) and gets the confirmation email naming the same order; also on a phone viewport. A declined card, then a retry. |
| `checkout.spec.ts`   | Prices belong to the server: a client-sent price is rejected, a stale total gets `PRICE_CHANGED`.                                                                                                            |
| `stock.spec.ts`      | Two shoppers race for the last unit: exactly one order, the other `INSUFFICIENT_STOCK`; stock ends at 0 available; the product page turns to **Sold out**.                                                   |
| `account.spec.ts`    | Register, confirm the email from the link in Mailpit, sign in, buy, find the order in the account.                                                                                                           |
| `fulfilment.spec.ts` | The back office prepares, ships (tracking number) and delivers; the customer gets both emails, sees the tracking, and leaves a review marked **Verified purchase**.                                          |
| `security.spec.ts`   | A fresh CSP nonce per page, no `unsafe-inline`; injected markup's inline handler is blocked; anonymous visitors are sent to sign in; customers are kept out of the back office (UI and API).                 |

Every test also fails on any CSP violation or uncaught error in the page, so a regression in
either shows up in the journey that caused it.

Rules the specs follow:

- **Independent data.** Each test uses a fresh email (and its Mailpit mailbox). Where quantities
  matter, it creates and stocks its own product through the admin API. Tests run in parallel and
  can be re-run on the same stack.
- **The user's view.** Locators are roles and labels (`getByRole`, `getByLabel`), never CSS
  classes. A change that breaks accessibility breaks a test.
- **No sleeps.** Waiting is on what the user would wait for: a status that appears, an email that
  arrives. Asynchronous steps (webhooks, Kafka) are polled with deadlines.
- **No retries.** A flaky journey is a bug, in the test or the shop. The first attempt's trace,
  screenshot and video say which.
- **Payments.** `PAYMENT_PROVIDER=mock` (the Compose default) confirms payments through the same
  signed-webhook path as Stripe, with a decline button. No external service is involved, so the
  run is deterministic and needs no secrets.

## What the suite found on its first run

Things no lower-level test could see:

- **Idle connections closed under the load balancer.** Node closes idle keep-alive connections
  after 5 s; the ALB keeps them for 60 s and may reuse one just as it closes, which ends in a 502. The test's API client hit exactly that while waiting for an email. Every service now keeps
  connections for 65 s (`tuneHttpServer` in `@market/nest-common`), as does the storefront
  (`KEEP_ALIVE_TIMEOUT`).
- **A CSP violation on every page.** Zod probes for `new Function` support to compile
  validators; the CSP (no `'unsafe-eval'`) blocked the probe and the browser reported it each
  time. The storefront now runs Zod in jitless mode.
- **Taps before hydration.** On a phone, tapping "Add to cart" before React has hydrated the
  server-rendered page does nothing. This is a trade-off of server rendering, not a bug we
  changed. The journey taps again until the button responds, as a shopper would.

## Running them

```bash
pnpm --filter @market/e2e exec playwright install chromium   # once
scripts/e2e.sh --build          # build images, start Compose, wait for the seeds, run everything
scripts/e2e.sh                  # stack already built: start it (or reuse it) and run
scripts/e2e.sh -- --grep stock  # a subset; anything after -- goes to Playwright
pnpm --filter @market/e2e exec playwright test --ui           # interactive, stack already up
pnpm --filter @market/e2e e2e:report                          # last HTML report
```

`E2E_WEB_URL`, `E2E_API_URL`, `E2E_MAIL_URL`, `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` point the
tests elsewhere. `E2E_CHROMIUM_PATH` uses a Chromium already on the machine.

In CI (`e2e` job) the same script runs with `--build --down`. A failed run keeps the HTML report,
traces (open with `npx playwright show-trace`), screenshots, videos and every service's logs as
the `e2e-report` artifact.

The journeys are not run against staging or production. They create orders, accounts and
emails, and staging takes real Stripe test-mode payments. After a deploy, the read-only smoke
tests run there instead.
