# syntax=docker/dockerfile:1.7
#
# One hardened image recipe for every NestJS service: the service is a build arg.
#   docker build -f infrastructure/docker/service.Dockerfile --build-arg SERVICE=order-service .
#
# Stages: prune the monorepo to the service and its workspace dependencies, install
# from the lockfile, build, then copy only production dependencies into a small
# runtime image that runs as the unprivileged `node` user.

# Official Node image via the AWS ECR mirror (no Docker Hub rate limits), pinned by digest.
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

FROM ${NODE_IMAGE} AS base
# Behind a TLS-inspecting proxy, pass its CA as a build secret (never baked into a layer):
#   docker build --secret id=extra_ca,src=/path/to/ca.pem ...
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1
# pnpm version comes from package.json#packageManager.
RUN corepack enable
WORKDIR /repo

FROM base AS prune
ARG SERVICE
COPY . .
RUN test -n "$SERVICE" || (echo "--build-arg SERVICE=<name> is required" && exit 1)
# Only the service, the workspace packages it depends on and a pruned lockfile.
RUN --mount=type=secret,id=extra_ca \
    NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca pnpm dlx turbo@2.11.7 prune "@market/${SERVICE}" --docker

FROM base AS build
ARG SERVICE
# Dependency layer first: it is cached until package.json files or the lockfile change.
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store --mount=type=secret,id=extra_ca \
    NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=prune /repo/out/full/ .
RUN pnpm turbo run build --filter="@market/${SERVICE}"
# Production dependencies only (workspace packages included as built copies), then
# just what runs: compiled code, SQL migrations and the manifest.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store --mount=type=secret,id=extra_ca \
    NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca pnpm --filter "@market/${SERVICE}" deploy --prod --legacy --store-dir /pnpm/store /deploy \
 && mkdir /out \
 && cp -r /deploy/node_modules /deploy/package.json /out/ \
 && cp -r "apps/${SERVICE}/dist" /out/dist \
 && if [ -d "apps/${SERVICE}/drizzle" ]; then cp -r "apps/${SERVICE}/drizzle" /out/drizzle; fi \
 && find /out/dist -name '*.map' -delete

FROM ${NODE_IMAGE} AS runtime
ARG SERVICE
ARG PORT=4000
LABEL org.opencontainers.image.title="cse-${SERVICE}" \
      org.opencontainers.image.source="https://github.com/CiupituStefan/Market-place"
ENV NODE_ENV=production \
    PORT=${PORT} \
    SERVICE_NAME=${SERVICE} \
    OTEL_SERVICE_NAME=${SERVICE}
# The runtime needs node only: package managers are attack surface, not features.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
# Owned by root, read-only for the app user: a compromised process cannot rewrite its code.
COPY --from=build /out ./
USER node
EXPOSE ${PORT}
# Liveness only: readiness (database, broker) is the orchestrator's job (/health/ready).
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# Node is PID 1 and handles SIGTERM itself (graceful shutdown in @market/nest-common).
# The preload starts OpenTelemetry before the app is imported; without
# OTEL_EXPORTER_OTLP_ENDPOINT it does nothing.
CMD ["node", "--import", "@market/telemetry/register", "dist/main.js"]
