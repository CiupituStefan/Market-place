# auth-service

Default port: **4001**

## Responsibilities

- Register, login, logout, refresh-token rotation.
- Forgot / reset password, email verification.
- Password hashing (Argon2id), brute-force protection.
- Roles: `USER`, `STAFF`, `ADMIN`; issues short-lived access tokens + rotating refresh tokens (httpOnly cookies).

## Owned data

`auth` database: `users`, `sessions`, `refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: `NotificationRequested` (verification / reset emails)
- Consumes: —

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/auth-service dev        # watch mode
pnpm --filter @market/auth-service test       # unit + integration tests
pnpm --filter @market/auth-service build && pnpm --filter @market/auth-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
