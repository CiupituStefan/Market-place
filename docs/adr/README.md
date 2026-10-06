# Architecture Decision Records

Each ADR records one significant decision: its context, the decision, and its consequences.
ADRs are immutable once accepted; a changed decision gets a new ADR that supersedes the old one.

| ADR                                                    | Title                                                                     | Status   |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | -------- |
| [ADR-001](ADR-001-microservices.md)                    | Microservices with database-per-service                                   | Accepted |
| [ADR-002](ADR-002-postgresql.md)                       | PostgreSQL + Drizzle, one database per service                            | Accepted |
| [ADR-003](ADR-003-kafka.md)                            | Kafka with transactional outbox, inbox and dead-letter topics             | Accepted |
| [ADR-004](ADR-004-stripe-payments.md)                  | Stripe PaymentIntents + Payment Element, webhook as source of truth       | Accepted |
| [ADR-007](ADR-007-monorepo.md)                         | pnpm + Turborepo monorepo, ESM, TS 6.0                                    | Accepted |
| [ADR-008](ADR-008-frontend.md)                         | Storefront architecture (Next.js)                                         | Accepted |
| [ADR-009](ADR-009-api-gateway.md)                      | Custom NestJS API gateway behind the ALB                                  | Accepted |
| [ADR-010](ADR-010-authentication.md)                   | Cookie sessions, EdDSA JWTs, rotating refresh tokens                      | Accepted |
| [ADR-011](ADR-011-catalog-search.md)                   | Catalog search on PostgreSQL behind an interface                          | Accepted |
| [ADR-012](ADR-012-inventory-concurrency.md)            | Row locking + DB invariants for stock                                     | Accepted |
| [ADR-013](ADR-013-cart-pricing-and-identity.md)        | Server-priced carts, hashed visitor tokens, coupons claimed at order time | Accepted |
| [ADR-014](ADR-014-checkout-saga.md)                    | Orchestrated checkout saga with persisted state and idempotent steps      | Accepted |
| [ADR-015](ADR-015-notifications.md)                    | Notifications from domain events, queued delivery log, SES                | Accepted |
| [ADR-016](ADR-016-admin-dashboard.md)                  | Admin dashboard: owning services for operations, event-built analytics    | Accepted |
| [ADR-017](ADR-017-containers-and-local-environment.md) | Container images and the Docker Compose development environment           | Accepted |
| [ADR-018](ADR-018-kubernetes-deployment.md)            | One Helm chart, migrations in init containers, External Secrets           | Accepted |
| [ADR-019](ADR-019-aws-infrastructure.md)               | AWS infrastructure in Terraform: three stacks, managed data services      | Accepted |
| [ADR-020](ADR-020-continuous-integration.md)           | GitHub Actions CI: scan before push, SHA-pinned everything, OIDC to ECR   | Accepted |
| [ADR-021](ADR-021-continuous-deployment.md)            | CD: staging on every merge, approved promotion, smoke-tested Helm         | Accepted |
| [ADR-022](ADR-022-public-repository-security.md)       | Public repository: GitHub-native security, signed provenance, settings    | Accepted |
| [ADR-023](ADR-023-observability.md)                    | OpenTelemetry everywhere; local LGTM stack, managed backends on AWS       | Accepted |
| [ADR-024](ADR-024-security-hardening.md)               | Nonce CSP, default-deny egress, Kyverno admission, Kafka ACLs as code     | Accepted |
| [ADR-025](ADR-025-end-to-end-testing.md)               | Playwright end-to-end journeys on the Docker Compose stack                | Accepted |

ADR-005 and ADR-006 were reserved for Kubernetes and AWS; those decisions are recorded in ADR-018
and ADR-019, written in the phases that implemented them.

## Template

```markdown
# ADR-NNN: Title

- Status: Proposed | Accepted | Superseded by ADR-XXX
- Date: YYYY-MM-DD

## Context

What forces are at play? What problem are we solving?

## Decision

What we decided, stated plainly.

## Alternatives considered

What else we looked at and why it lost.

## Consequences

What becomes easier, what becomes harder, and what we must do because of it.
```
