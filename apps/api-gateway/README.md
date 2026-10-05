# api-gateway

Default port: **4000**. The only backend component exposed to the internet (behind the AWS ALB +
WAF). Owns no data.

## Request pipeline

```
client ──▶ helmet (security headers) ──▶ CORS ──▶ request context (x-request-id, access log)
       ──▶ RateLimitGuard (Redis, per IP) ──▶ OriginGuard (CSRF) ──▶ route table
       ──▶ ProxyService (undici, streamed) ──▶ upstream service
```

| Concern            | Implementation                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Routing            | `src/routing/routes.ts`: longest-prefix match on segment boundaries; paths forwarded unchanged            |
| Internal endpoints | Any path with an `internal` segment returns 404 — service-to-service APIs are never public                |
| Bodies             | Not parsed: streamed byte-for-byte (Stripe webhook signatures stay valid); size-limited while streaming   |
| Correlation        | `x-request-id` accepted if well-formed, otherwise generated; forwarded upstream and echoed back           |
| Spoofing           | Client-sent `x-user-*`, `x-internal-*`, `x-forwarded-*`, `forwarded`, `x-real-ip` are dropped             |
| Rate limiting      | Fixed window per client IP and policy; Redis (shared) with in-memory fallback; IETF `RateLimit-*` headers |
| CSRF               | Unsafe methods need an allowed `Origin`/`Referer`, or no cookies at all (see `src/security/origin.ts`)    |
| CORS               | Allow-list from `CORS_ORIGINS`, credentials enabled                                                       |
| Failures           | Upstream down → 503 `SERVICE_UNAVAILABLE`; slow → 504 `UPSTREAM_TIMEOUT`; never leaks upstream addresses  |
| Docs               | `/docs`: one Swagger UI over every service's `/openapi.json` (disabled in production by default)          |
| Health             | `/health/live`, `/health/ready` — readiness never depends on upstreams or Redis                           |

## Rate-limit policies

| Policy             | Matches                                                                   | Limit / min / IP |
| ------------------ | ------------------------------------------------------------------------- | ---------------- |
| `auth-credentials` | `POST /auth/{login,register,forgot-password,reset-password,verify-email}` | 10               |
| `payments`         | `POST /payments/*`                                                        | 20               |
| `writes`           | any other `POST/PUT/PATCH/DELETE`                                         | 120              |
| `reads`            | everything else                                                           | 600              |
| —                  | `/payments/webhook` (machine route)                                       | exempt           |

## Configuration

See `.env.example`. Every upstream URL is configurable (`AUTH_SERVICE_URL`, `ORDER_SERVICE_URL`,
…); in Kubernetes they point at cluster-internal service DNS names.

## Coming in later phases

- **Phase 4:** access-token verification at the edge and role checks for `/api/v1/admin/**`.
  Services will still verify the token themselves (zero trust between pods).
- **Phase 19:** W3C `traceparent` propagation and RED metrics via OpenTelemetry.

## Development

```bash
pnpm --filter @market/api-gateway dev
pnpm --filter @market/api-gateway test                      # unit + integration (fake upstream)
REDIS_URL=redis://localhost:6379 pnpm --filter @market/api-gateway test   # + Redis store tests
```
