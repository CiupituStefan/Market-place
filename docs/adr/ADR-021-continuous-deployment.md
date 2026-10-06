# ADR-021: Continuous deployment: staging on every merge, approved promotion, smoke-tested Helm

- Status: Accepted; amended by [ADR-022](ADR-022-public-repository-security.md) (provenance
  verified before deploying, environments and ruleset applied by script)
- Date: 2026-10-06

## Context

Images are built once per commit and pushed to ECR (ADR-020). The required flow is: ECR →
staging → smoke tests → approval → production. Every production deployment must be possible
to roll back (rule 13), and CI must not hold long-lived AWS credentials. The deploy identity
can change what runs in production, so it should be able to do nothing else.

## Decision

1. **Staging deploys in the build run**, right after the images are pushed. Main runs are
   serialised, so staging always moves forward in commit order.
2. **Production is promoted by a separate workflow.** It starts when a build run on main
   succeeds, checks that the commit has a successful _smoke-tested on staging_ record (a
   GitHub deployment), and waits on the `production` environment's required reviewers. It
   lives outside the build run so that a pending approval never blocks later builds.
3. **One reusable deploy job for both environments.** It checks the images exist, runs
   `helm upgrade --install --atomic --wait`, smoke-tests through the public edge and rolls
   back if the smoke tests fail. Automatic runs refuse to deploy a commit older than the one
   deployed; manual runs may, and that is the rollback path.
4. **Least-privilege deploy role.**
   - **In AWS:** the role can describe the cluster, read its own SSM parameter and check that
     images exist.
   - **Values:** Terraform writes the chart's account-specific values (no secrets) to that SSM
     parameter, so the pipeline never reads Terraform state.
   - **In Kubernetes:** an EKS access entry maps the role to a group, which is bound to a
     namespaced Role covering only the chart's kinds. The EKS `Edit` access policy was
     replaced because it grants Secrets.
   - **Secrets:** Helm stores releases in ConfigMaps, so the role has no access to Secrets. A
     chart check keeps the rendered kinds and the Role in step.
5. **Read-only smoke tests**, safe for production. They cover availability, the error
   contract and the edge's security behaviour, and the same script runs against Docker
   Compose.

## Alternatives considered

- **Argo CD / Flux (GitOps)**: drift correction and a cluster-side audit trail, but another
  system to run, secure and upgrade, plus a second repository or write access for CI to bump
  tags. With one chart and two environments, a pipeline that runs Helm is simpler. Revisit
  with more clusters or teams.
- **Canary / blue-green (Argo Rollouts)**: smaller blast radius, but it needs traffic metrics
  to judge a canary, which arrive with observability (Phase 19). Rolling updates with
  readiness, PDBs, `--atomic` and smoke-test rollback are the baseline until then.
- **Production in the same run as staging**: one graph to read, but the approval wait would
  hold the build concurrency group and stall every later merge.
- **`workflow_run` for staging too**: the build run already has the SHA and serialisation.
  `workflow_run` is kept only where it is needed, and it accepts only successful pushes to main.
- **The EKS `AmazonEKSEditPolicy`**: one line of Terraform, but it covers every namespaced
  resource, Secrets included.

## Consequences

- Every merge reaches staging within minutes; production needs a human approval and can only
  receive commits that passed staging.
- Database migrations are not rolled back, so they must stay expand/contract
  ([database](../database.md)). The rollback guarantee depends on that discipline.
- A new kind of Kubernetes object in the chart needs a matching change to the Terraform Role.
  `helm/check.sh` fails until both are updated.
- Terraform applies remain an operator action. CI validates and tests every infrastructure
  change, but applying from a pipeline would need a role that can change IAM.
- The pipeline has not run against a live cluster from this repository yet. The scripts and
  logic were exercised locally (smoke tests against Docker Compose, image checks, the
  ancestry guard), and the workflows pass actionlint and zizmor.
