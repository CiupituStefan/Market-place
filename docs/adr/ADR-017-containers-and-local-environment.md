# ADR-017: Container images and the Docker Compose development environment

- Status: Accepted
- Date: 2026-10-05

## Context

Eleven deployable units (ten NestJS services and the Next.js app) need images that are small,
reproducible and safe to run in production, and developers need the whole system — databases,
Kafka, email, object storage — with one command.

## Decision

1. **One parametrised Dockerfile for all NestJS services** (`--build-arg SERVICE`), plus one for
   the web app. Every service still gets its own image; the hardening (pinned base, non-root,
   read-only code, no package managers, health check) lives in one place and cannot drift
   between ten copies.
2. **`turbo prune` + `pnpm deploy --prod`**: each image contains its service, the workspace
   packages it depends on and production dependencies only.
3. **Base images from the AWS ECR mirror of Docker official images, pinned by digest**: identical
   content to Docker Hub without its anonymous pull limits (which also bite CI), and closer to
   EKS.
4. **Docker Compose** runs the full system: PostgreSQL (one database and role per service),
   Redis, Kafka in KRaft mode, Kafka UI, Mailpit (SMTP sink), an S3-compatible object store
   (RustFS) and all services built from the same Dockerfiles as production. Services run with
   `NODE_ENV=development` (migrations on start, mock payments, development keys).
5. **Idempotent one-shot jobs** using the services' own images: bucket setup, admin account, demo
   catalog, stock and discount codes. They run on every `up` and exit.
6. **Only the gateway and the web app are published on all interfaces**; databases, broker and
   tools are bound to `127.0.0.1`.

## Alternatives considered

- **Ten near-identical Dockerfiles** — what the spec literally suggests, but every security fix
  would have to be made ten times.
- **MinIO** for local S3 — its community images are no longer published. RustFS is S3-compatible
  (pre-signed POST policies, CORS, bucket policies) and Apache-2.0. LocalStack is ~1 GB for one
  API we use.
- **Distroless runtime** — smaller attack surface still, but no shell for `docker exec`
  debugging; Alpine without package managers is the compromise for now (revisit in Phase 20).
- **Running services from source with `nest start --watch` in containers** — faster edit loop,
  but the compose stack would no longer exercise the production images. `pnpm dev` on the host
  against Compose infrastructure covers that loop.

## Consequences

- `NEXT_PUBLIC_*` values are build arguments, so the web image is built per environment (API URL).
  Moving them to runtime configuration is a follow-up if one image must serve several
  environments.
- Local images are served unoptimised by `next/image` (the optimiser runs inside the container
  and cannot reach the host's `localhost`); production uses CloudFront over HTTPS.
- In development the auth-service signing key is generated at start (a unique `kid` each time),
  so restarting it signs everyone out.
