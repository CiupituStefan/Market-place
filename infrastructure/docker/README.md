# Container images

| File                 | Builds                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `service.Dockerfile` | any NestJS service: `--build-arg SERVICE=<name> --build-arg PORT=…` |
| `web.Dockerfile`     | the Next.js storefront and back office (standalone output)          |
| `postgres/`          | local database bootstrap: one database and role per service         |

```bash
docker build -f infrastructure/docker/service.Dockerfile \
  --build-arg SERVICE=order-service --build-arg PORT=4005 -t cse/order-service:$(git rev-parse --short HEAD) .
docker build -f infrastructure/docker/web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t cse/web:$(git rev-parse --short HEAD) .
```

Production tags are Git SHAs, never `latest`: CI ([build.yml](../../.github/workflows/build.yml))
builds, scans and pushes `<sha>`, and `web:<sha>-<environment>` because the storefront compiles
its public URLs in ([docs/ci.md](../../docs/ci.md)).

## What every image does

- **Prunes the monorepo** (`turbo prune`) to the service and the workspace packages it uses, then
  installs from the lockfile (`--frozen-lockfile`): the dependency layer is cached until a
  `package.json` or the lockfile changes.
- **Ships only what runs**: compiled `dist/`, SQL migrations, production dependencies
  (`pnpm deploy --prod`); no sources, tests, source maps or dev tools.
- **Hardened runtime**: official Node 22 Alpine image pinned by digest (from the AWS ECR mirror
  of Docker official images: no Docker Hub rate limits); npm, npx, corepack and yarn removed; runs
  as the unprivileged `node` user; application files owned by root (read-only for the process).
- **Health**: a `HEALTHCHECK` on `/health/live`; Compose and Kubernetes use `/health/ready`
  (database and broker) for traffic.
- **Signals**: Node is PID 1 and handles `SIGTERM` (Nest shutdown hooks: in-flight requests and
  Kafka messages finish, then pools close). A service that cannot start exits non-zero so the
  orchestrator restarts it.

## Building behind a TLS-inspecting proxy

Corporate proxies re-sign TLS with their own CA. Pass it as a **build secret** (never baked into
a layer):

```bash
docker build --secret id=extra_ca,src=/path/to/proxy-ca.pem ...
EXTRA_CA_FILE=/path/to/proxy-ca.pem docker compose build
```
