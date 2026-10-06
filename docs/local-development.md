# Local development

## Everything with Docker Compose

```bash
docker compose up --build        # first run builds 11 images (a few minutes)
docker compose up -d             # later runs
docker compose logs -f order-service
docker compose down              # stop; add -v to also delete databases, Kafka and stored images
```

| URL                         | What                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| http://localhost:3000       | storefront                                                                 |
| http://localhost:3000/admin | back office — `admin@csekeyboards.test` / `admin passphrase for local dev` |
| http://localhost:4000/docs  | API gateway, OpenAPI for every service                                     |
| http://localhost:8080       | Kafka UI (topics, consumer groups, dead-letter topics)                     |
| http://localhost:8025       | Mailpit: every email the shop sends                                        |
| http://localhost:9001       | object storage console (`localdev` / `localdev-storage-secret`)            |

On every `up`, one-shot jobs prepare the image bucket and load the demo admin, catalog, stock and
discount codes (`WELCOME10`, `SWITCHUP15`, `LAUNCH20`); they are idempotent. Payments use the mock
provider (a "Pay (test)" button that goes through the real webhook path). For Stripe test mode
put `PAYMENT_PROVIDER=stripe` and your `STRIPE_*` test keys in a `.env` file next to
`docker-compose.yml` (git-ignored) — see [payments](payments.md#local-development).

Infrastructure ports are bound to `127.0.0.1` only: PostgreSQL `5432` (`postgres` /
`postgres-dev-password`; each service has its own database and role, `<db>-dev-password`), Redis
`6379`, Kafka `9094`, object storage `9000`.

Traces, metrics and logs: `docker compose --profile observability up -d`, then Grafana on
http://localhost:3001 ([observability](observability.md)).

Images and the Dockerfiles are described in [infrastructure/docker](../infrastructure/docker/README.md);
the reasoning in [ADR-017](adr/ADR-017-containers-and-local-environment.md).

## Hot reload on the host, infrastructure in Docker

```bash
nvm use && corepack enable && pnpm install && pnpm build
docker compose up -d postgres redis kafka mailpit object-storage kafka-ui
```

Then run the services you are working on with `pnpm --filter @market/<service> dev`, pointing
them at the containers (or stop the same service in Compose and run it from source):

```bash
DATABASE_URL=postgresql://orders:orders-dev-password@localhost:5432/orders \
KAFKA_BROKERS=localhost:9094 \
  pnpm --filter @market/order-service dev
```

Each service's `.env.example` lists its variables; copy it to `.env` to keep overrides
(git-ignored). Services validate their environment at startup and refuse to boot on invalid
values, listing every problem at once (values are never printed).

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

## Tests

- Unit tests: `src/**/*.test.ts`, next to the code.
- Integration tests: `test/**/*.test.ts`, booting the Nest app in-process (PGlite for the
  database) and calling it with Supertest.
- Real-infrastructure suites run when their variables are set, e.g. with Compose running:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres-dev-password@localhost:5432/postgres \
REDIS_URL=redis://localhost:6379 KAFKA_BROKERS=localhost:9094 pnpm test
```

## Adding a service

```bash
# 1. register its port in packages/config/src/services.ts
# 2. generate the skeleton
scripts/scaffold-service.sh shipping-service "Carrier integrations and label printing."
pnpm install
# 3. add it to docker-compose.yml (build args SERVICE/PORT) and its database to
#    infrastructure/docker/postgres/init-databases.sh
```
