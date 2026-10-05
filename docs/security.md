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
