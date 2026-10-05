# Architecture Decision Records

Each ADR records one significant decision: its context, the decision, and its consequences.
ADRs are immutable once accepted; a changed decision gets a new ADR that supersedes the old one.

| ADR                                 | Title                                   | Status   |
| ----------------------------------- | --------------------------------------- | -------- |
| [ADR-001](ADR-001-microservices.md) | Microservices with database-per-service | Accepted |
| [ADR-007](ADR-007-monorepo.md)      | pnpm + Turborepo monorepo, ESM, TS 6.0  | Accepted |

Planned: ADR-002 PostgreSQL, ADR-003 Kafka, ADR-004 Stripe, ADR-005 Kubernetes, ADR-006 AWS —
written in the phase that implements each decision.

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
