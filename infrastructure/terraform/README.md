# Terraform: AWS infrastructure

Everything the shop runs on in AWS, in `eu-central-1`: network, EKS, RDS PostgreSQL,
ElastiCache (Valkey), MSK, S3 + CloudFront for product images, ECR, ACM, WAF, SES, IAM, and the
cluster add-ons the Helm chart expects. Reasoning: [ADR-019](../../docs/adr/ADR-019-aws-infrastructure.md).

```
bootstrap/          state bucket (local state, applied once per account)
stacks/
  global/           ECR repositories + GitHub OIDC provider and the image build role
  infra/            one environment: VPC, EKS, RDS, cache, MSK, images CDN, WAF, SES, IAM
  platform/         inside the cluster: namespace, ALB controller, External Secrets,
                    ExternalDNS, metrics-server (reads infra's outputs from its state)
modules/            one per concern; stacks only wire them together
envs/
  global/           global.tfvars, global.backend.hcl
  staging/          infra/platform .tfvars and .backend.hcl
  production/
check.sh            fmt, validate, tests (mock providers), tflint, checkov — also in CI
```

Separate stacks keep the blast radius small: an add-on upgrade (`platform`) cannot replace the
database (`infra`), and `global` holds the one thing shared by both environments (the images,
built once and promoted by Git SHA). Staging and production are the same code with different
`.tfvars`: staging trades redundancy for cost (one NAT gateway, single-AZ database and cache,
small brokers), production is Multi-AZ everywhere.

## Security properties

- **No credentials in code or state.** Terraform authenticates with the operator's SSO session or,
  in CD, a GitHub OIDC role. The RDS master password is managed by RDS in Secrets Manager; the
  cache auth token and the Kafka SCRAM passwords are generated as ephemeral values and written to
  Secrets Manager with write-only arguments, so they never appear in plans or state.
- **Remote state**: S3 with versioning, KMS encryption, TLS-only policy, no public access, native
  S3 locking (`use_lockfile`).
- **Nothing data-bearing is reachable from the internet**: RDS, the cache and MSK sit in data
  subnets without a route out of the VPC and accept connections only from the EKS cluster
  security group; all three require TLS (`rds.force_ssl`, Valkey transit encryption, MSK TLS +
  SASL/SCRAM). Everything is encrypted at rest with the environment's KMS key (rotation on).
- **Least privilege**: per-service IRSA roles (product-service → its image prefix, notification-service
  → SES), External Secrets reads only `cse/<env>/*` and that environment's MSK secrets, CI can push
  images (main branch only) and deploy into one namespace (GitHub environment only). No IAM users,
  no access keys.
- **Edge**: CloudFront (TLS 1.2+, origin access control to a private bucket) for images; ALB
  behind AWS WAF (managed rule groups, rate limits on sign-in and checkout, logs with
  `authorization`/`cookie` redacted).
- Nodes: IMDSv2 only with hop limit 1 (pods cannot borrow the node role), encrypted gp3 volumes;
  EKS secrets envelope-encrypted; control plane, VPC flow and WAF logs kept a year.

## First-time setup (per AWS account)

Prerequisites: Terraform 1.11+ (1.16 in CI), AWS CLI with an admin SSO session, the domain's
Route 53 hosted zone in the account.

```bash
cd infrastructure/terraform

# 1. State bucket (local state for this one; keep bootstrap/terraform.tfstate safe or re-import).
terraform -chdir=bootstrap init
terraform -chdir=bootstrap apply -var name=cse-tfstate-<account-id>
#    then replace REPLACE_WITH_ACCOUNT_ID in envs/**/*.backend.hcl and platform.tfvars

# 2. Shared: ECR + GitHub OIDC
terraform -chdir=stacks/global init -backend-config=../../envs/global/global.backend.hcl
terraform -chdir=stacks/global apply -var-file=../../envs/global/global.tfvars

# 3. An environment (staging first, then production)
terraform -chdir=stacks/infra init -backend-config=../../envs/staging/infra.backend.hcl
terraform -chdir=stacks/infra apply -var-file=../../envs/staging/infra.tfvars

terraform -chdir=stacks/platform init -backend-config=../../envs/staging/platform.backend.hcl
terraform -chdir=stacks/platform apply -var-file=../../envs/staging/platform.tfvars
```

Switching environments re-initialises the backend: add `-reconfigure` to `init`. Then follow the
two runbooks below once per environment. Deployments then come from CD
([docs/deployment.md](../../docs/deployment.md)): `infra` writes the chart's account-specific
values (registry, ARNs, hosts; no secrets) to the SSM parameter `/cse/<env>/helm-values`, and the
platform stack gives the CI deploy role a namespaced Role (`cse-deployer`) without access to
Secrets.

### Databases and roles

RDS creates only the master user (`cse_admin`, password in the secret named by the
`database_master_secret_arn` output). Each service gets its own database and two roles
(ADR-002): an owner that runs migrations and an application role that reads and writes data
only. From a one-off pod in the cluster (the database is not reachable from anywhere else):

```sql
-- for each <db> in: auth products inventory cart orders payments notifications reviews admin
CREATE ROLE "<db>_owner" LOGIN PASSWORD '<generated>';
CREATE ROLE "<db>_app"   LOGIN PASSWORD '<generated>';
GRANT "<db>_owner" TO cse_admin;            -- RDS: the master must be a member to create the DB
CREATE DATABASE "<db>" OWNER "<db>_owner";
REVOKE ALL ON DATABASE "<db>" FROM PUBLIC;
GRANT CONNECT ON DATABASE "<db>" TO "<db>_app";
\c <db>
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO "<db>_app";
ALTER DEFAULT PRIVILEGES FOR ROLE "<db>_owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "<db>_app";
ALTER DEFAULT PRIVILEGES FOR ROLE "<db>_owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "<db>_app";
```

Generate the passwords (`openssl rand -base64 32`) straight into the secrets below; they are
never written anywhere else.

### Application secrets

Terraform creates the empty Secrets Manager entries `cse/<env>/<component>`; operators put the
values in (console, or `aws secretsmanager put-secret-value --secret-id cse/staging/order-service
--secret-string file://-` from stdin). Keys per component are listed in the
[chart README](../helm/README.md#secrets):

- `DATABASE_URL` =
  `postgresql://<db>_app:…@<database_endpoint>/<db>?sslmode=verify-full&sslrootcert=/etc/ssl/rds/ca.pem`
  (the chart mounts the RDS root certificates there; the server certificate is verified, not
  just encrypted)
- `DATABASE_MIGRATION_URL` = the same with `<db>_owner`
- `JWT_PRIVATE_KEY` (auth), `STRIPE_*` (payment, from the Stripe dashboard),
  `UNSUBSCRIBE_SECRET` (notification).

Kafka credentials (`AmazonMSK_cse-<env>_<service>`) and the cache URL (`cse/<env>/redis`) are
written by Terraform; the chart reads them from there, so nobody copies them.

### Rotating generated credentials

Raise the matching number in the environment's `infra.tfvars` and apply:

```hcl
credential_versions = { redis = 2 } # or kafka = 2
```

Terraform generates a new value and writes it to the service and to Secrets Manager in the same
apply; External Secrets refreshes within an hour (or annotate the ExternalSecret
`force-sync=$(date +%s)`), then restart the deployments. A cache token change is immediate, so
rotate it in a quiet window. RDS rotates the master password itself.

## Observability

`infra` creates the backends (module `observability`):

- an Amazon Managed Service for Prometheus workspace, with the alert rules from
  `infrastructure/observability/prometheus/alerts.yml` and an Alertmanager that publishes to an
  encrypted SNS topic. Set `alert_email` and confirm the subscription email;
- the CloudWatch log group `/cse/cse-<env>/application` (30 days, 90 in production);
- Amazon Managed Grafana (`grafana.enabled`). It needs IAM Identity Center in the account; put
  the operators' group IDs in `grafana.admin_group_ids`. The deploy pipeline syncs dashboards
  into it.

X-Ray needs no resource. `platform` runs the OpenTelemetry collector, whose IRSA role may only
write to these. See [docs/observability.md](../../docs/observability.md).

## Kafka topics and ACLs

Services create the topics they use at startup. The MSK configuration sets
`allow.everyone.if.no.acl.found=true`, so **any authenticated service user may use any topic**
today; unauthenticated access is impossible (SCRAM only). Per-topic ACLs (each user may write
the topics it publishes, read the topics it consumes, and create exactly those) are a follow-up:
they need a Kafka admin client inside the VPC (the Terraform Kafka provider or a job in the
cluster), after which `allow_all_authenticated` is turned off.

## Changing things

- `terraform plan` always before `apply`, run by an operator with an SSO session (CI validates
  and tests every change; applying from a pipeline needs a role broad enough to change IAM and
  is not automated). Every module pins its provider major version; the stacks commit their lock files
  (`terraform providers lock -platform=linux_amd64 -platform=linux_arm64 -platform=darwin_arm64
-platform=darwin_amd64` after changing providers).
- `./check.sh` before pushing (needs terraform, tflint, checkov). Nothing in it touches AWS.
- Destroying production needs `deletion_protection` turned off first, on purpose; RDS keeps a
  final snapshot.

## Costs (rough, eu-central-1, on-demand)

| Environment | Main items                                                                             | ≈ per month  |
| ----------- | -------------------------------------------------------------------------------------- | ------------ |
| staging     | EKS control plane, 2× t3a.large, 1 NAT, db.t4g.small, cache.t4g.micro, 3× t3.small MSK | $550–650     |
| production  | EKS, 3× m7i.large, 3 NAT, db.m7g.large Multi-AZ, 2× cache.t4g.small, 3× m7g.large MSK  | $2,000–2,400 |

MSK and the NAT gateways dominate. Cheaper options when traffic is low: MSK Serverless, or one
NAT gateway in production too (an AZ outage then cuts outbound traffic from the other zones).
