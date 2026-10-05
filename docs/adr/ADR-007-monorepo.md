# ADR-007: pnpm + Turborepo monorepo, ESM, TypeScript 6.0

- Status: Accepted
- Date: 2026-10-05

## Context

Eleven deployables (web + ten services) share contracts: the error format, money handling, roles,
event schemas and configuration rules. A contract change must be visible to every producer and
consumer in a single change set, and CI must only rebuild what changed.

## Decision

- **One repository**, `pnpm` workspaces (`apps/*`, `packages/*`), `turbo` as the task runner.
- **Shared packages** (each built to `dist/` with `tsc`, consumed via `workspace:*`):
  - `@market/types` — money (integer minor units), roles, error codes + standard error body,
    pagination, header names.
  - `@market/events` — versioned Kafka event envelope and payload schemas (Zod), topic names,
    registry used by consumers to validate and route to the DLQ.
  - `@market/config` — fail-fast, typed environment loading (Zod); canonical service/port list.
  - `@market/logger` — pino JSON logging with automatic `request_id` from AsyncLocalStorage and
    secret redaction.
  - `@market/tsconfig`, `@market/eslint-config` — shared strict compiler and lint settings.
- **ESM everywhere** (`"type": "module"`, `module: NodeNext`). NestJS 12 is published as ESM only,
  so this is the path of least resistance and matches Next.js.
- **TypeScript 6.0**, not 7.0. TypeScript 7 (the native port) is the current `latest`, but
  `typescript-eslint` supports `<6.1` at the time of writing; type-aware linting matters more to
  us than compile speed. Revisit when typescript-eslint supports 7.x.
- **Vitest** for unit and integration tests in every workspace. NestJS services run tests through
  SWC (`unplugin-swc`) because Nest's dependency injection needs emitted decorator metadata,
  which esbuild/oxc do not produce. Supertest drives HTTP integration tests.
- `pnpm` hardening: `strict-peer-dependencies`, no hoisting, and an allow-list
  (`onlyBuiltDependencies`) for packages permitted to run install scripts.

## Alternatives considered

- **Polyrepo** (one repository per service): independent histories, but contract changes need
  coordinated releases of a shared package across many repositories. Rejected for a small team.
- **Nx**: more features (generators, project graph UI) but heavier configuration. Turborepo's
  caching and task graph cover our needs.
- **npm/yarn workspaces**: pnpm's strict, non-flat `node_modules` catches undeclared dependencies,
  which matters when each service is shipped as its own Docker image.
- **Jest**: Jest's ESM support is still experimental; Vitest runs ESM natively.

## Consequences

- One `pnpm install`, one lockfile, one CI pipeline with per-package caching.
- Shared packages must be built before dependants; Turborepo's `dependsOn: ["^build"]` handles it.
- Docker images (Phase 14) will use `turbo prune --docker` to copy only the workspaces a service
  needs, keeping images small and build caches effective.
- Discipline required: shared packages must stay free of domain logic (see ADR-001).
