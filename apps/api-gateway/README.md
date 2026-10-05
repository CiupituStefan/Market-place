# api-gateway

Default port: **4000**

## Responsibilities

- Single public entry point for the web app (`/api/v1/*`).
- Generates / propagates the `x-request-id` correlation ID.
- Validates access tokens (JWT, issued by auth-service) and forwards the user identity to upstream services.
- Rate limiting (Redis-backed), CORS, secure headers, request size limits.
- Routes requests to services over REST; aggregates OpenAPI docs.
- Exposes the raw-body Stripe webhook route to payment-service (no auth, signature-verified downstream).

## Owned data

None (stateless). Uses Redis only for rate-limit counters.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: —
- Consumes: —

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/api-gateway dev        # watch mode
pnpm --filter @market/api-gateway test       # unit + integration tests
pnpm --filter @market/api-gateway build && pnpm --filter @market/api-gateway start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
