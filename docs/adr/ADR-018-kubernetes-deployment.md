# ADR-018: One Helm chart, migrations in init containers, External Secrets

- Status: Accepted
- Date: 2026-10-05

## Context

Eleven components deploy to EKS together, from images tagged with the Git SHA, into staging and
production. Each needs the same production basics (probes, autoscaling, disruption budgets,
security context, network isolation, secrets from AWS Secrets Manager) and the services with a
database must migrate before new code serves traffic, without secrets in Git (rule 1).

## Decision

1. **One chart, `components` map**: every template loops over the components, so a security or
   availability fix applies to all of them at once; per-component differences (port, health
   paths, replicas, `allowFrom`, IRSA role, env) are values. One release per namespace per
   environment; resources are named after the service, so in-cluster URLs are identical
   everywhere (`http://order-service:4005`).
2. **Migrations in an init container** of each service's pods, using `DATABASE_MIGRATION_URL`
   (schema owner); the app container uses `DATABASE_URL` (data-only role). `runMigrations` holds
   a Postgres advisory lock, so replicas starting together migrate once. Migrations follow
   expand/contract so the previous release keeps working during a rollout.
3. **Secrets via External Secrets Operator**: one Secrets Manager JSON per component and
   environment, synced into `<component>-secrets`; the chart only references them.
4. **Kafka topics are created by the services** that use them, not by Terraform. (Correction,
   Phase 16: per-topic MSK ACLs are not applied yet; see ADR-019.)
5. **Validation without a cluster**: values schema, helm-unittest, kubeconform against the
   Kubernetes and CRD schemas, kube-linter — in CI on every pull request.

## Alternatives considered

- **An umbrella chart with eleven sub-charts** — eleven copies of the same templates to keep in
  sync; sub-charts pay off when components are versioned or released independently, which they
  are not.
- **Migration Job as a Helm `pre-upgrade` hook** — on the first install the hook runs before the
  ExternalSecret exists, so it cannot get its credentials; hooks are also invisible to
  `helm rollback`. Revisit if migrations become slow enough to delay pod start-up.
- **Secrets as Helm values from CI** (`--set`) — they would end up in the Helm release secret and
  in CI logs/history, and rotation would need a redeploy.
- **Sealed Secrets / SOPS in Git** — encrypted secrets in Git still need key management; Secrets
  Manager is already the source of truth for RDS and MSK credentials (rule 14).
- **Terraform-managed topics** — another provider and a network path from CI to the brokers,
  for a list the services already own.

## Consequences

- The cluster must provide the AWS Load Balancer Controller, External Secrets Operator,
  metrics-server and network policy enforcement (Terraform, Phase 16).
- The chart could not be installed in this repository's CI sandbox (no nested containers), so it
  is validated statically; the first real install is staging (Phase 18), where `--atomic` rolls
  back a failed rollout.
- `NEXT_PUBLIC_*` values are built into the web image, so the web image is built per environment.
