# Market-place — mechanical keyboard store

A production-oriented e-commerce platform for mechanical and custom keyboards, keycaps, switches,
stabilizers, cables, desk mats and accessories. Built as TypeScript microservices (NestJS) with a
Next.js storefront, PostgreSQL, Redis, Kafka and Stripe, deployed to Kubernetes on AWS.

> **Status: Phase 7 of 21 — server-priced carts, discount codes and wishlists.**
> See the [roadmap](#roadmap).

## Architecture at a glance

```
             ┌──────────────┐
 browser ──▶ │  web (Next)  │
             └──────┬───────┘
                    │ /api/v1/*
             ┌──────▼───────┐      Stripe webhooks
             │ api-gateway  │◀──────────────────────
             └──────┬───────┘
     REST (sync)    │
 ┌────────┬─────────┼──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
 auth   product  inventory    cart      order     payment   notification review     admin
  │        │        │          │          │          │          │          │          │
  └────────┴────────┴──────────┴────── Kafka (async events) ───┴──────────┴──────────┘
 each service ─▶ its own PostgreSQL database (no cross-service DB access)
```

Key rules (details in [ADR-001](docs/adr/ADR-001-microservices.md)):

- Database-per-service; services talk via REST (request/response) and Kafka (events).
- The backend always recomputes prices, discounts, tax, shipping and totals.
- Stripe webhooks are the only source of truth for payment status, and are processed idempotently.
- Inventory reservations prevent overselling.

## Repository layout

```
apps/
  web/                    Next.js storefront + /admin shell       port 3000
  api-gateway/            edge: routing, auth, rate limits        port 4000
  auth-service/           users, sessions, tokens, RBAC           port 4001
  product-service/        catalog, variants, search, configurator port 4002
  inventory-service/      stock, reservations, movements          port 4003
  cart-service/           carts, coupons, wishlist                port 4004
  order-service/          orders, checkout orchestration          port 4005
  payment-service/        Stripe intents, webhooks, refunds       port 4006
  notification-service/   email, preferences, newsletter          port 4007
  review-service/         reviews, votes                          port 4008
  admin-service/          back-office facade, analytics           port 4009
packages/
  types/                  money, roles, error format, pagination
  events/                 versioned Kafka event contracts
  config/                 typed env loading, service/port registry
  logger/                 pino JSON logs + request_id correlation
  nest-common/            service bootstrap, error filter, validation, health, OpenAPI, auth guard
  db/                     PostgreSQL pool, migrations, transactional outbox, PGlite tests
  eslint-config/          shared flat ESLint configs
  tsconfig/               shared strict tsconfigs
infrastructure/
  terraform/              AWS (Phase 16)
  helm/                   Kubernetes charts (Phase 15)
docs/
  adr/                    Architecture Decision Records
scripts/
  scaffold-service.sh     generates a NestJS service skeleton
```

Every service follows the same skeleton: `src/config.ts` (Zod-validated env), `src/main.ts`
(`startService` from `@market/nest-common`: structured logging, request IDs, standard errors,
health probes, `/openapi.json`), `test/` (Supertest integration tests) and a README describing the
data it owns and the events it publishes/consumes.

## Requirements

- Node.js **22.12+** (`.nvmrc`)
- pnpm **10+** (`corepack enable` picks the version from `package.json`)
- Docker (from Phase 14, for PostgreSQL / Redis / Kafka)

## Getting started

```bash
corepack enable
pnpm install
pnpm build          # builds shared packages and services (Turborepo, cached)
pnpm test           # unit + integration tests across the monorepo
```

Run the storefront (catalog pages need product-service + gateway; see docs/local-development.md):

```bash
pnpm --filter @market/web dev
# http://localhost:3000
```

Run the gateway and a service (Swagger UI for all services at http://localhost:4000/docs):

```bash
pnpm --filter @market/api-gateway dev
pnpm --filter @market/product-service dev
curl -i localhost:4000/api/v1/products     # proxied to product-service, with x-request-id
```

## Scripts

| Command          | What it does                                                   |
| ---------------- | -------------------------------------------------------------- |
| `pnpm build`     | Build every workspace in dependency order                      |
| `pnpm dev`       | Run all services in watch mode                                 |
| `pnpm lint`      | ESLint (type-aware, strict) in every workspace                 |
| `pnpm typecheck` | `tsc --noEmit` in every workspace                              |
| `pnpm test`      | Vitest unit + Supertest integration tests                      |
| `pnpm format`    | Prettier write                                                 |
| `pnpm check`     | Everything CI runs: format check, lint, typecheck, test, build |

Filter any task with Turborepo, e.g. `pnpm turbo run test --filter=@market/events`.

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · Zod · NestJS ·
OpenAPI · PostgreSQL · Redis · Apache Kafka · Stripe Payment Element · S3 + CloudFront · Docker ·
Kubernetes (Helm) · Terraform · AWS (EKS, RDS, ElastiCache, MSK, ECR, WAF) · GitHub Actions (OIDC)
· OpenTelemetry · Prometheus · Grafana · Vitest · Supertest · Playwright

## Roadmap

| #   | Phase                                          | Status |
| --- | ---------------------------------------------- | ------ |
| 1   | Repository, monorepo, tooling, shared packages | ✅     |
| 2   | Next.js frontend shell                         | ✅     |
| 3   | API Gateway                                    | ✅     |
| 4   | Auth service                                   | ✅     |
| 5   | Product service                                | ✅     |
| 6   | Inventory service                              | ✅     |
| 7   | Cart service                                   | ✅     |
| 8   | Order service                                  |        |
| 9   | Payment service + Stripe                       |        |
| 10  | Kafka events (outbox / inbox / DLQ)            |        |
| 11  | Notification service                           |        |
| 12  | Review service                                 |        |
| 13  | Admin dashboard                                |        |
| 14  | Docker Compose                                 |        |
| 15  | Kubernetes + Helm                              |        |
| 16  | Terraform + AWS                                |        |
| 17  | GitHub Actions CI                              |        |
| 18  | GitHub Actions CD                              |        |
| 19  | Observability                                  |        |
| 20  | Security hardening                             |        |
| 21  | E2E testing                                    |        |

## Documentation

- [API conventions](docs/api.md)
- [Databases](docs/database.md)
- [Events](docs/events.md)
- [Security](docs/security.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Local development](docs/local-development.md)
- [Storefront (apps/web)](apps/web/README.md)

## Security

Never commit secrets. `.env` files are git-ignored; each service ships a `.env.example` with
non-secret defaults only.
