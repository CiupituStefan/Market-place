# ADR-024: Nonce CSP, default-deny egress, Kyverno admission, Kafka ACLs as code

- Status: Accepted
- Date: 2026-10-06

## Context

After phases 1–19 the perimeter was solid: WAF, TLS everywhere, authenticated services, signed
images verified by the deploy pipeline. The [threat model](../threat-model.md) showed what was
left once an attacker gets one foothold:

- **Storefront XSS.** The CSP allowed `'unsafe-inline'` scripts, so one injection bug would mean
  scripts running next to the checkout.
- **Lateral movement and exfiltration from a compromised pod.** Ingress was default-deny, egress
  was not: any pod could reach any address, including the internet and the metadata endpoint.
- **Bypassing the pipeline.** Only the deploy workflow checked image provenance. `kubectl` with
  leaked deployer credentials could run any image.
- **Kafka.** Every authenticated service could read and write every topic. A compromised
  review-service could forge `payment.succeeded` events.

## Decision

1. **Strict CSP with per-request nonces** (Next.js `proxy.ts`): `'nonce-…' 'strict-dynamic'`,
   no `'unsafe-inline'` scripts, Stripe as the only third party. Pages render per request (a
   nonce cannot be baked into static HTML); catalog data keeps its 60 s cache.
2. **Default-deny egress** in the Helm chart, generated from the same `allowFrom` graph as
   ingress, plus the data subnets for stores, the collector and opt-in HTTPS to the internet for
   the four components that call external APIs. The metadata endpoint is always excluded.
3. **Kyverno admission control** on the application namespace, using its CEL policy types
   (`ValidatingPolicy`, `ImageValidatingPolicy`; `ClusterPolicy` is deprecated):
   - images come only from our ECR registry, by commit SHA or digest;
   - images carry SLSA provenance signed keyless by `build.yml` on `main`, which `build.yml`
     now pushes next to each image.

   Fail-closed, scoped to that namespace so a Kyverno outage cannot block system pods.

4. **Kafka ACLs as code.** `packages/events/src/access.ts` lists what each service publishes and
   consumes. It drives:
   - a generated `acls.txt`/`topics.txt` (CI fails if stale);
   - a startup check in `@market/messaging`;
   - an idempotent, declarative job in the cluster that runs as a dedicated admin user and
     removes ACLs not in the list.

   Services lose the right to create topics.

## Alternatives considered

- **CSP hashes instead of nonces**: they keep static pages, but Next.js inline bootstrap scripts
  change with every build and with the data, so the hashes are not predictable.
  `'unsafe-inline'` with host allow-lists is bypassable.
- **Cilium/Calico FQDN policies** for egress to `api.stripe.com` only: tighter, but this needs a
  different CNI than the EKS VPC CNI. Port 443 outside the VPC for four named components is the
  pragmatic bound. The WAF and the network firewall remain options.
- **Gatekeeper, or sigstore policy-controller:** Kyverno does both rules (registry/tag and
  attestations) with one tool, its CLI tests policies in CI, and it reads ECR through IRSA.
- **ACLs via the Terraform Kafka provider:** MSK is not reachable from where Terraform runs (on
  purpose). A VPN or bastion for it would add more risk than the job.
- **ACLs via a Node script in a service image:** this would couple admin tooling to an application
  image. The stock Kafka CLI, pinned by digest, is enough.

## Consequences

- Every page is rendered per request: more CPU on `web`, which the HPA covers. The CDN still
  serves static assets.
- Adding an external API to a component means setting `internetEgress`. Adding a topic means
  editing `access.ts`, regenerating, and applying `platform` before the deploy. Both fail loudly
  (blocked connection, startup error) rather than silently.
- Images built before this change have no attestations in ECR, so Kyverno rejects them. A
  rollback can only go to builds made after it. Images are kept with their attestations
  (lifecycle rules only expire tagged images).
- A new MSK cluster needs a two-step bootstrap (`kafka_acls_enforced`), documented in the
  Terraform README.
- Kyverno adds a fail-closed admission dependency: three replicas. If it is down, new
  application pods wait and the running ones keep serving.
