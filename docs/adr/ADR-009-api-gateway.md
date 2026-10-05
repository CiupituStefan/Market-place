# ADR-009: Custom NestJS API gateway behind the AWS ALB

- Status: Accepted
- Date: 2026-10-05

## Context

The browser talks to ten services. We need one public origin with consistent cross-cutting
behaviour: request IDs, CORS, rate limiting, CSRF protection, a uniform error format, raw-body
passthrough for Stripe webhooks, and (Phase 4) authentication with httpOnly cookies.

## Decision

A small NestJS gateway (`apps/api-gateway`) that streams requests to services with `undici`:

- **No body parsing.** Bodies are streamed byte-for-byte and size-limited in flight; this keeps
  Stripe webhook signatures valid and memory flat under large uploads.
- **Static route table** with longest-prefix matching; `internal` paths are never routable.
- **Redis fixed-window rate limiting** per client IP with an in-memory fallback, so a Redis outage
  degrades limits to per-instance instead of failing open or taking the API down.
- **CSRF via Origin/Referer verification** on unsafe methods, on top of SameSite cookies.
- **Readiness independent of dependencies**: a Redis or upstream outage must not remove every
  gateway pod from the load balancer.
- Shared service plumbing lives in `@market/nest-common`, used by the gateway and all services.

In front of it, AWS provides TLS termination, WAF rules and DDoS protection (ALB + WAF, Phase 16).

## Alternatives considered

- **AWS API Gateway (HTTP API)**: managed, but cookie-based auth, CSRF origin checks and our error
  format would live in Lambda authorizers/mappings, and local development would differ from
  production. Payload and timeout limits are also tighter.
- **Kong / Envoy / NGINX**: mature and fast. Rejected for now because the edge logic we need
  (session cookies, CSRF, error contract, request-ID semantics) would be written in Lua/Wasm/config
  outside the TypeScript codebase and test suite. If raw throughput becomes the bottleneck, Envoy can
  take over routing while auth stays in a service.
- **BFF in Next.js route handlers**: couples the API to the web deployment and leaves mobile or
  partner clients without a stable edge.

## Consequences

- One more hop per request (~1 ms in-cluster); mitigated by keep-alive connection pooling.
- The gateway is stateless and horizontally scalable; Redis is the only shared state.
- Fixed windows allow up to 2× the limit across a window boundary; acceptable for abuse
  protection. A sliding-window script can replace it without changing callers.
