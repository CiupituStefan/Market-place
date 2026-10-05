# Security

Security controls by layer. Items marked _(Phase N)_ land in that phase.

## Identity and sessions

- Argon2id password hashing, length-based password policy, rehash on login.
- Short-lived EdDSA access tokens + rotating, hashed refresh tokens with reuse detection.
- Tokens only in `HttpOnly` cookies; `Secure` in production; refresh cookie scoped to
  `/api/v1/auth` with `SameSite=Strict`.
- Generic login errors, timing equalisation for unknown emails, temporary account lockout,
  per-IP rate limits on credential endpoints.
- Password reset and role changes revoke all sessions; forgot-password never reveals whether an
  account exists.
- Email links require an explicit click (scanners that prefetch links cannot consume them).

## Visitor carts

- The `cse_cart` cookie holds a random 256-bit token (`HttpOnly`, `SameSite=Lax`, `Secure` in
  production); only its SHA-256 is stored. Malformed values are ignored, so the cookie cannot be
  used to probe the database.
- An invalid or expired session token on cart endpoints is a 401, never a silent switch to the
  visitor cart.
- Cart bodies are strict schemas: prices, totals or discounts sent by a client are rejected (400).

## Orders

- Orders are snapshots built server-side from cart-service's priced cart; the request carries only
  contact details, addresses and the total the shopper saw (`expectedTotal`, used to detect a change,
  never to set a price).
- Guests reach their order through the httpOnly cart cookie that placed it, or a random 256-bit
  order token returned once (both stored hashed); unknown orders and orders of other users both
  answer `404`, so ids cannot be probed.
- Payment status changes only through order-service's internal API, called by payment-service from
  verified Stripe webhooks; `/internal` routes are unreachable through the gateway.
- `POST /api/v1/orders` has its own tight rate limit (20/min per client).

## Authorization (RBAC)

- Roles: `USER`, `STAFF`, `ADMIN`. Every service verifies the JWT and roles itself
  (`@Authenticated()` from `@market/nest-common`) — the network is not trusted.
- The gateway additionally rejects anonymous / non-staff traffic to `/api/v1/admin/**` at the edge.
- The web app's `/admin` gate and `proxy.ts` redirects are UX only.

## Edge (api-gateway)

- CSRF: Origin/Referer verification for cookie-authenticated writes, on top of `SameSite`.
- CORS allow-list with credentials; helmet security headers; strict CSP on JSON responses.
- Client-supplied identity/forwarding headers are stripped; `internal` routes are unreachable.
- Body size limits enforced while streaming; upstream addresses never leak in errors.

## Data protection

- Standard error body; stack traces and internal messages are never returned.
- Logs are JSON with automatic redaction of passwords, tokens, cookies and auth headers.
- Card data never touches our systems: Stripe Payment Element _(Phase 9)_.
- Database roles per service, no public database/Redis/Kafka endpoints _(Phase 16)_.

## Supply chain and platform _(Phases 17–20)_

Dependency and container scanning in CI, GitHub OIDC to AWS (no long-lived keys), least-privilege
IAM, Kubernetes RBAC and NetworkPolicies, secrets from AWS Secrets Manager, CSP with nonces on the
storefront, WAF managed rules.
