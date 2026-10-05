# ADR-010: Cookie-based sessions with EdDSA access tokens and rotating refresh tokens

- Status: Accepted
- Date: 2026-10-05

## Context

The storefront is a browser app talking to many services. Sessions must be secure against XSS
token theft, CSRF and stolen refresh tokens, while services must authorize requests without a
synchronous call to auth-service on every request.

## Decision

- **Access token**: JWT signed with **Ed25519 (EdDSA)**, 15-minute lifetime, verified locally by
  every service via the JWKS published by auth-service. Asymmetric keys mean services can verify
  but never mint tokens; only `EdDSA` is accepted (no algorithm confusion).
- **Refresh token**: opaque random value stored hashed, rotated on every use, bound to a session
  with an absolute lifetime. Reuse of a rotated token revokes the session; a short grace window
  avoids false positives when two tabs refresh simultaneously.
- **Transport**: `HttpOnly` cookies only; refresh cookie limited to `/api/v1/auth` and
  `SameSite=Strict`. Non-browser clients may send `Authorization: Bearer`.
- **Deployment**: the storefront and API share one site (ingress routes `/api/*` to the gateway),
  so cookies stay host-only and first-party.

## Alternatives considered

- **Tokens in localStorage**: readable by any XSS payload. Rejected.
- **Opaque session id + central session lookup on every request**: simplest revocation, but every
  service would depend synchronously on auth-service or a shared session store.
- **HS256 shared secret**: every verifier could also forge tokens.
- **Managed identity (Cognito/Auth0)**: viable and worth revisiting; adds vendor coupling and
  limits control over UX flows and data residency for a first version.

## Consequences

- Revocation is immediate for refresh and for `/auth/me`, but an already-issued access token stays
  valid until it expires (≤ 15 minutes). Sensitive operations can check the session (`sid`).
- Key rotation: deploy the new key with the previous public key in the JWKS, wait one access-token
  TTL, then remove the old key.
