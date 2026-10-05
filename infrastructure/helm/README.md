# Helm: `marketplace`

One chart deploys the whole application into a namespace: the Next.js app, the API gateway and
the nine services. For every component it renders a **Deployment, Service, ConfigMap, secret
reference (ExternalSecret), ServiceAccount, HPA, PodDisruptionBudget** (when there are two or more
replicas) and a **NetworkPolicy**, plus one ALB **Ingress**. Why it is shaped this way:
[ADR-018](../../docs/adr/ADR-018-kubernetes-deployment.md).

```
marketplace/
  Chart.yaml
  values.yaml              defaults (every component, security settings)
  values-staging.yaml      staging overrides
  values-production.yaml   production overrides
  values.schema.json       rejects typos, `latest`, secrets in plain env
  templates/               one template per resource kind, looping over `components`
  tests/                   helm-unittest suites
  ci/example-values.yaml   stand-ins for Terraform outputs (lint and tests only)
```

## Deploying

```bash
helm upgrade --install marketplace infrastructure/helm/marketplace \
  --namespace cse-staging \
  -f infrastructure/helm/marketplace/values-staging.yaml \
  -f terraform-outputs-staging.yaml \
  --set global.image.tag="$GIT_SHA" \
  --atomic --timeout 15m
```

`terraform-outputs-<env>.yaml` carries the account-specific values (ECR registry, ACM certificate
and WAF ARNs, VPC CIDR, MSK brokers, image bucket, IRSA role ARNs); the CD pipeline generates it
(Phase 18). Images are always tagged with the Git SHA: the chart refuses an empty tag and
`latest`. `--atomic` rolls back automatically when the rollout does not become ready; a manual
rollback is `helm -n cse-staging rollback marketplace`.

## What the cluster must provide

Installed with the cluster (Terraform, Phase 16), not by this chart:

- **AWS Load Balancer Controller** (`alb` ingress class) and **metrics-server** (HPA).
- **External Secrets Operator** with a `ClusterSecretStore` named `aws-secrets-manager`
  (IRSA, read-only on `cse/<environment>/*`).
- **Network policy enforcement** (VPC CNI with network policies enabled).
- A namespace per environment labelled `pod-security.kubernetes.io/enforce: restricted`.

## Secrets

Nothing secret is in Git or in values files. Each component reads the Kubernetes Secret
`<component>-secrets`, which External Secrets fills from the AWS Secrets Manager JSON entry
`cse/<environment>/<component>`:

| Key                                                                    | Components                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL` (data role)                                             | every service with a database                  |
| `DATABASE_MIGRATION_URL` (schema owner)                                | every service with a database (init container) |
| `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`                           | every service                                  |
| `JWT_PRIVATE_KEY` (+ `JWT_PREVIOUS_PUBLIC_KEY` during rotation)        | auth-service                                   |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | payment-service                                |
| `UNSUBSCRIBE_SECRET`                                                   | notification-service                           |
| `REDIS_URL` (`rediss://`, ElastiCache auth token)                      | api-gateway                                    |

The values schema refuses environment variables whose names look like secrets
(`*SECRET*`, `*PASSWORD*`, `*TOKEN*`, `*PRIVATE_KEY*`, `DATABASE_URL`) in ConfigMaps.

## Security defaults

Non-root user, read-only root filesystem (writable `emptyDir` only where needed), all
capabilities dropped, no privilege escalation, `RuntimeDefault` seccomp, no service account
token mounted and no Kubernetes RBAC permissions; AWS access only through per-service IRSA roles
(product-service → image bucket, notification-service → SES). Ingress is denied by default; each
service accepts calls only from the components in its `allowFrom`, and only `web` and
`api-gateway` from the load balancer. The ALB is HTTPS-only (TLS 1.2+/1.3 policy) behind AWS WAF.

## Availability

Rolling updates never go below the desired capacity (`maxUnavailable: 0`); replicas are spread
over zones and nodes; a `preStop` pause lets the load balancer drain before shutdown; PDBs keep a
replica up during node drains; HPAs scale on CPU and shrink slowly.

## Checking the chart

```bash
infrastructure/helm/check.sh   # helm-unittest, lint, kubeconform (K8s 1.33 + CRDs), kube-linter
```

CI runs the same script on every pull request.
