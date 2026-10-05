# auth-service

Default port: **4001**. Identity, sessions and roles for CSE Keyboards.

## API (`/api/v1`)

| Method | Path                        | Auth           | Notes                                                        |
| ------ | --------------------------- | -------------- | ------------------------------------------------------------ |
| POST   | `/auth/register`            | –              | Creates a USER, emails a verification link (via outbox)      |
| POST   | `/auth/login`               | –              | Sets `cse_at` + `cse_rt` httpOnly cookies                    |
| POST   | `/auth/refresh`             | refresh cookie | Rotates the refresh token, issues a new access token         |
| POST   | `/auth/logout`              | refresh cookie | Revokes the session, clears cookies                          |
| GET    | `/auth/me`                  | access token   | Current user (checks the session is still active)            |
| POST   | `/auth/forgot-password`     | –              | Always 202 (no account enumeration)                          |
| POST   | `/auth/reset-password`      | reset token    | Sets the password, revokes every session                     |
| POST   | `/auth/verify-email`        | email token    | Marks the email as verified                                  |
| POST   | `/auth/verify-email/resend` | access token   | Invalidates older links and sends a new one                  |
| GET    | `/users`                    | STAFF, ADMIN   | Paginated search                                             |
| PATCH  | `/users/:id/roles`          | ADMIN          | Revokes the user's sessions so changes apply immediately     |
| GET    | `/.well-known/jwks.json`    | –              | Public keys (outside `/api/v1`, fetched by gateway/services) |

## Tokens and sessions

- **Access token**: EdDSA (Ed25519) JWT, 15 minutes, claims `sub`, `sid`, `roles`,
  `email_verified`. Verified by every service against the JWKS (zero trust).
- **Refresh token**: 256-bit random, stored as SHA-256, **rotated on every use**. Reusing a rotated
  token revokes the whole session (theft detection); a reuse within 10 s is treated as a benign
  two-tab race and does not revoke.
- **Sessions** have an absolute lifetime (30 days). Logout, password reset and role changes revoke
  them.
- **Cookies**: `cse_at` (`HttpOnly; SameSite=Lax; Path=/`), `cse_rt`
  (`HttpOnly; SameSite=Strict; Path=/api/v1/auth`), `Secure` in production.

## Passwords and brute force

Argon2id (19 MiB, t=2), NIST-style policy (12–128 chars, not equal to the email), transparent
rehash on login when parameters change, constant-shape responses for unknown emails, a lockout after
5 consecutive failures (15 min), plus per-IP rate limits at the gateway.

## Data

`auth` database: `users`, `sessions`, `refresh_tokens`, `one_time_tokens`, `outbox_events`.
Migrations are SQL files in `drizzle/`, generated from `src/db/schema.ts`.

## Events

Publishes `NotificationRequested` (verification and reset emails) through the transactional outbox;
the Kafka relay arrives in Phase 10.

## Commands

```bash
pnpm --filter @market/auth-service dev                # migrates on start in development
pnpm --filter @market/auth-service test               # unit + integration on in-process Postgres (PGlite)
pnpm --filter @market/auth-service db:generate        # after editing src/db/schema.ts
pnpm --filter @market/auth-service build && pnpm --filter @market/auth-service db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long passphrase' pnpm --filter @market/auth-service seed:admin
```
