# Local development

> Phase 1 covers the Node.js toolchain only. Docker Compose with PostgreSQL, Redis, Kafka and
> Kafka UI arrives in Phase 14.

## Setup

```bash
nvm use            # Node 22 (reads .nvmrc)
corepack enable    # pnpm version pinned in package.json#packageManager
pnpm install
pnpm build
```

## Daily workflow

```bash
pnpm dev                                        # all services in watch mode
pnpm --filter @market/order-service dev         # one service
pnpm --filter @market/events dev                # rebuild a shared package on change
pnpm turbo run test --filter=...@market/types   # test a package and everything that depends on it
pnpm check                                      # what CI runs, before pushing
```

Shared packages are consumed from their `dist/` output. When you change one while a service is
running in watch mode, run that package's `dev` script too so the service picks up the rebuild.

## Configuration

Each service validates its environment at startup (`src/config.ts`) and refuses to boot on
invalid values, listing every problem at once (values are never printed). Copy a service's
`.env.example` to `.env` to override defaults locally; `.env` files are git-ignored.

## Adding a service

```bash
# 1. register its port in packages/config/src/services.ts
# 2. generate the skeleton
scripts/scaffold-service.sh shipping-service "Carrier integrations and label printing."
pnpm install
```

## Tests

- Unit tests: `src/**/*.test.ts`, next to the code.
- Integration tests: `test/**/*.test.ts`, booting the Nest app in-process and calling it with
  Supertest.
- NestJS tests run through SWC so decorator metadata (needed for DI) is emitted.
