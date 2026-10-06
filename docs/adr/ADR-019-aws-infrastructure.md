# ADR-019: AWS infrastructure in Terraform: three stacks, managed data services

- Status: Accepted
- Date: 2026-10-06

## Context

The shop runs on EKS (ADR-018) and needs PostgreSQL, Redis, Kafka, object storage with a CDN,
an image registry, TLS certificates, a WAF and outbound email, in two environments (staging,
production) that must look the same. Constraints: no credentials in code or state (rule 1),
nothing data-bearing reachable from the internet, CI/CD without long-lived AWS keys, and
managed services wherever they remove real operational work (rule 14).

## Decision

1. **Terraform, three stacks plus a bootstrap.** `global` (ECR, GitHub OIDC provider, image build
   role), `infra` per environment (VPC, EKS, RDS, ElastiCache, MSK, images CDN, WAF, SES, IAM)
   and `platform` per environment (in-cluster add-ons via the Helm provider, reading `infra`'s
   outputs from its state). Stacks are thin; reusable pieces are local modules. Environments
   differ only in `.tfvars`. Remote state in S3 (versioned, KMS, TLS-only) with native S3 locking.
2. **Managed data services**: RDS PostgreSQL 16 (one instance, a database and roles per service,
   Multi-AZ in production), ElastiCache Valkey (TLS + auth token) for the gateway's rate limits,
   Amazon MSK provisioned (3 brokers, TLS + SASL/SCRAM, one user per service). All in data
   subnets without a route out of the VPC, reachable only from the EKS cluster security group.
3. **No generated secret in state.** RDS manages its master password; the cache token and Kafka
   passwords are ephemeral values written with write-only arguments to Secrets Manager, rotated
   by bumping a version number. Application secrets (Stripe keys, JWT key, DB URLs) are filled in
   by operators into Terraform-created entries; External Secrets syncs everything into pods.
4. **Identity without keys**: GitHub OIDC roles (build: main branch only, ECR push; deploy: per
   GitHub environment, EKS access scoped to the environment's namespace), IRSA per service,
   EKS access entries instead of the `aws-auth` ConfigMap, IMDSv2 with hop limit 1 on nodes.
5. **Edge**: ALB (created by the AWS Load Balancer Controller from the chart's Ingress) behind
   AWS WAF; CloudFront with origin access control in front of a private image bucket; ACM
   certificates and Route 53 records (ExternalDNS for the ALB hosts).
6. **Verification without an AWS account**: `terraform test` with mock providers for the stacks
   and the modules with logic, tflint (AWS ruleset) and checkov (skips justified inline), run by
   `check.sh` locally and in CI.

## Alternatives considered

- **One state per environment for everything**: simpler to apply, but an add-on change plans
  against the database and the blast radius of a mistake is the whole environment.
- **Terragrunt / workspaces**: Terragrunt removes some backend repetition at the cost of another
  tool; workspaces hide which environment a command targets. Explicit `-backend-config` and
  `-var-file` per environment are verbose but obvious.
- **Aurora PostgreSQL**: faster failover and storage autoscaling, but a higher floor price;
  RDS Multi-AZ is enough for this load and Aurora remains a migration away.
- **MSK Serverless**: no broker sizing, but IAM authentication only (the services use SCRAM,
  which also works locally) and per-partition pricing; reconsider if traffic stays low.
- **Self-managed Kafka/Redis on EKS (Strimzi, Bitnami)**: cheaper on paper, but upgrades,
  storage, failover and backups become our job (rule 14).
- **Generating secrets into Terraform state** (`random_password` + `secret_string`): the common
  pattern, but state then holds every credential in clear text.

## Consequences

- Fixed monthly cost even when idle (about $600 staging, $2,000+ production), dominated by MSK
  and NAT gateways. Cheaper options are documented in the Terraform README.
- Database roles and application secrets are a manual runbook per environment (once), because
  Terraform cannot reach the private database and must not hold those secrets.
- Kafka per-topic ACLs are not applied yet: `allow.everyone.if.no.acl.found=true`, so any
  authenticated service may use any topic. Applying them needs an admin client inside the VPC;
  it is tracked as a follow-up, and ADR-018's claim that ACLs exist was corrected.
- Services verify the RDS server certificate against the RDS root certificates shipped in the
  Helm chart (`sslmode=verify-full`).
- The deploy pipeline (Phase 18) reads the `helm_values` output of `infra` and the registry from
  `global`, so deploy jobs need read access to the state bucket.
