# Threat model

STRIDE per trust boundary: what crosses it, what could go wrong, what stops it. The controls are
detailed in [security](security.md); decisions in [ADR-022](adr/ADR-022-public-repository-security.md)
and [ADR-024](adr/ADR-024-security-hardening.md). Review on every new boundary (a new external
API, a new data store, a new kind of user).

**Assets, most valuable first:**

1. Payment integrity: an order marked paid only when Stripe says so.
2. Customer accounts and personal data: emails, addresses, order history.
3. Stock and price correctness: no overselling, no client-chosen prices.
4. Availability of browsing and checkout.
5. The supply chain: code, images, infrastructure credentials.

Card data is not an asset we hold: it never leaves Stripe (PCI SAQ A).

```
browser ──(1)── CloudFront/ALB+WAF ── web ──(2)── api-gateway ──(3)── services ──(4)── PostgreSQL / Redis
                                                                         │
                         Stripe ──(5)── payment-service              Kafka (6)
GitHub ──(7)── ECR / EKS (CI/CD)         operators ──(8)── AWS / cluster
```

## 1. Internet → edge and storefront

| Threat                            | Controls                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **S** session theft               | `HttpOnly`/`Secure`/`SameSite` cookies, short-lived JWTs, rotating refresh tokens with reuse detection     |
| **T** XSS, injected scripts       | React escaping, nonce + `strict-dynamic` CSP (tested: injected inline scripts blocked), no `unsafe-inline` |
| **T** clickjacking                | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                                          |
| **R** disputed actions            | request ID in every response, logs and traces; order history is append-only                                |
| **I** data in transit             | TLS 1.2+ only, HSTS preload                                                                                |
| **D** floods, credential stuffing | WAF managed rules and rate limits (sign-in, checkout), gateway rate limits                                 |
| **E** reaching the admin area     | RBAC enforced by the API; the web redirect is only convenience                                             |

## 2. Web app → API gateway → 3. services

| Threat                                 | Controls                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| **S** forged identity headers          | the gateway strips client identity/forwarding headers; services verify JWTs themselves (JWKS) |
| **T** client-chosen price or quantity  | prices and totals computed server-side from the catalog; stock reserved atomically            |
| **T** CSRF                             | Origin/Referer checks on cookie-authenticated writes, `SameSite`                              |
| **I** internal errors, internal routes | standard error body without stack traces; `internal` routes unreachable through the gateway   |
| **E** IDOR (another user's order)      | ownership checked in every service query; admin routes require the admin role                 |

## 4. Services → data stores

| Threat                             | Controls                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **S/E** another service's database | one database and role per service; network policy allows stores only to their owners' egress; no shared credentials |
| **T** SQL injection                | parameterised queries only (Drizzle), Semgrep/CodeQL in CI                                                          |
| **I** exposure                     | data subnets without internet routes, security groups from EKS only, TLS with verified certificates, KMS at rest    |
| **D** connection exhaustion        | pool limits, HPA, PodDisruptionBudgets                                                                              |

## 5. Stripe → payment-service

| Threat                   | Controls                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **S** forged webhook     | signature verification with the endpoint secret, timestamp tolerance                       |
| **T/R** replayed webhook | idempotent processing by event ID (inbox); the webhook is the only source of payment state |
| **I** card data          | Stripe Payment Element; card data never reaches our servers                                |

## 6. Services ↔ Kafka

| Threat                                         | Controls                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **S** forged events (fake `payment.succeeded`) | SCRAM user per service; ACLs: only payment-service may write payment events                                      |
| **I** reading other contexts' events           | ACLs: read only the topics in `access.ts`, consumer groups `<service>.*` only                                    |
| **T** ACL drift, self-granted rights           | declarative job removes unlisted ACLs; only `kafka-admin` may alter ACLs; its secret is readable by the job only |
| **D** poison messages                          | bounded retries, dead-letter topics, alerts                                                                      |

## 7. GitHub → AWS (CI/CD)

| Threat                               | Controls                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| **T** malicious dependency or action | lockfile, dependency review, Trivy, actions pinned by SHA, tools by checksum            |
| **T** image swapped after the build  | immutable SHA tags; signed provenance verified at deploy **and at admission** (Kyverno) |
| **E** stolen long-lived keys         | none exist: GitHub OIDC roles limited to `main`/environments                            |
| **E** deploy role abuse              | namespaced Role without Secrets; Kyverno rejects images we did not build                |
| **I** secrets in the public repo     | gitleaks on the whole history, push protection, no secrets in values                    |

## 8. Operators → AWS / cluster

| Threat                         | Controls                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| **S** account takeover         | SSO roles only (MFA is enforced in IAM Identity Center, outside this repo); no IAM users    |
| **R** untraceable changes      | EKS audit logs (a year), Terraform in Git with reviews; CloudTrail's 90-day event history   |
| **E** pod escaping to the node | PSS `restricted`, IMDSv2 hop limit 1, egress to metadata blocked, no service account tokens |

## Accepted risks and follow-ups

- Egress to the internet is by port (443 outside the VPC) for four components, not by host name:
  a compromised one could reach any HTTPS server. Narrowing it needs an FQDN-aware CNI or AWS
  Network Firewall.
- Kyverno pulls Sigstore trust roots and checks the public transparency log at admission. If
  either is unreachable, new application pods are rejected (fail-closed).
- Docker Hub is the source of the kafka-access job image (pinned by digest). An ECR pull-through
  cache would remove that dependency.
- No organisation CloudTrail trail with long retention is defined here (account-level setup).
- No runtime threat detection (GuardDuty EKS runtime monitoring, Falco). It is cheap to enable
  later at the account level.
