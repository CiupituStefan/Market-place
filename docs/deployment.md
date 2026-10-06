# Deployment

Every commit on `main` is built, deployed to staging and smoke-tested. After a reviewer
approves, the same commit goes to production. Nothing is deployed from a laptop, and no
long-lived AWS key exists anywhere.

```
push to main
  └─ build.yml       build + scan 12 images ─► ECR (tag = commit SHA)
       └─ staging    deploy-staging.yml ─► deploy.yml: images + signed provenance? ─► helm --atomic ─► smoke tests
                                                       (failure: helm rolls back / we roll back)
                                                       └─ record "smoke-tested on staging"
deploy-production.yml (starts when the build run succeeds)
  └─ passed staging?  ─► waits for approval (GitHub environment `production`)
       └─ production  deploy.yml, same commit, same steps
```

| Workflow                                                              | Trigger                                 | Does                                    |
| --------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- |
| [`deploy.yml`](../.github/workflows/deploy.yml)                       | called only                             | one commit → one environment (below)    |
| [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml)       | `build.yml` on main; by hand with a SHA | staging                                 |
| [`deploy-production.yml`](../.github/workflows/deploy-production.yml) | successful build run on main; by hand   | checks staging passed, approval, deploy |

## One deployment (`deploy.yml`)

1. Check out the commit being deployed, so the chart and values match the images.
2. Assume the environment's deploy role through GitHub OIDC. The role trusts only jobs bound
   to that GitHub environment.
3. **Refuse missing or unproven images.** Every component's image for that SHA must be in
   ECR (the web app's tag is `<sha>-<environment>`). Each must carry Sigstore-signed
   attestations, a SLSA build provenance and an SBOM, proving it was built by `build.yml` on
   `main`, from exactly this commit, on a GitHub-hosted runner. An image pushed by anything
   else is refused, even with the right tag. If a build pushed an image but failed before
   attesting it, delete that tag in ECR and re-run the build.
4. Read the account-specific Helm values that Terraform wrote to SSM (`/cse/<env>/helm-values`).
   They contain no secrets.
5. **Never move backwards by accident.** An automatic run fails if the deployed commit is newer.
   Only a manual run may deploy an older commit, which is how a rollback is done.
6. Run `helm upgrade --install --atomic --wait`. Each service's pods first run its migrations
   (init container) and then must pass readiness. If the rollout does not become ready within
   15 minutes, Helm restores the previous release itself.
7. **Smoke tests** ([`scripts/smoke-test.sh`](../scripts/smoke-test.sh)) run through the public
   hosts: the WAF, the ALB, TLS, the gateway and the services. All checks are read-only:
   - readiness, the home and shop pages, the product list and categories;
   - the standard error body with no stack traces;
   - `internal` routes unreachable, the back office closed to anonymous users, cross-site
     writes refused;
   - HSTS, and HTTP → HTTPS.

   **If they fail, the job rolls back to the previous revision.**

8. Record a GitHub deployment `smoke-tested` for the commit. Production requires this record
   from staging.
9. Sync the commit's Grafana dashboards into Amazon Managed Grafana (`scripts/grafana-sync.sh`,
   15-minute service-account token, deleted afterwards). A failure here warns but does not undo
   the deployment.

Deployments of one environment never overlap: a newer one waits, it never interrupts. While a
promotion waits for approval, a newer commit replaces any older one still pending.

## Database migrations

Migrations only move forward and run before the new pods take traffic. Rolling the
application back does not undo them, so every migration must work with the previous release
still running: expand first (new tables, nullable or defaulted columns), then contract (drop,
tighten) only in a later release ([database](database.md)). This is what makes rolling back
safe.

## Rolling back

- **Automatic:** a rollout that never becomes ready (`--atomic`), or failed smoke tests.
- **Production, by hand:** run **Deploy production** with the last good commit's SHA. It must
  have passed staging, which it did. The images are already in ECR, so this takes minutes and
  still goes through approval.
- **Staging, by hand:** run **Deploy staging** with a SHA.
- **Emergency, from a terminal** with cluster admin access:
  `HELM_DRIVER=configmap helm -n cse-production rollback marketplace`.
  The next pipeline deploy moves forward again.

## What the deploy role can do

The deploy role can:

- describe the cluster;
- read its environment's SSM parameter;
- read image metadata in ECR (existence, digests for provenance checks), never push;
- inside the cluster, through the Role `cse-deployer` in its namespace only, manage the kinds
  the chart renders: Deployments, Services, ConfigMaps, ServiceAccounts, HPAs, PDBs,
  NetworkPolicies, Ingresses and ExternalSecrets;
- read pods, logs and events.

It has **no access to Secrets**. Helm keeps its release records in ConfigMaps, and
`helm/check.sh` fails if the chart ever renders a kind outside that list. It cannot push
images, read Terraform state or change IAM.

## Repository settings

[`scripts/configure-github.sh`](../scripts/configure-github.sh) creates the `staging` and
`production` environments. Both deploy from `main` only, and production has required
reviewers. The script also sets their `AWS_DEPLOY_ROLE_ARN` variables (the `deploy_role_arn`
output of each environment's `infra` stack). Details are in
[repository settings](repository-settings.md).
