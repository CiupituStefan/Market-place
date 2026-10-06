# ADR-020: GitHub Actions CI: scan before push, SHA-pinned everything, OIDC to ECR

- Status: Accepted; amended by [ADR-022](ADR-022-public-repository-security.md) (public repository:
  CodeQL, dependency review, code scanning, signed provenance)
- Date: 2026-10-06

## Context

Every change must be linted, type-checked, tested against real infrastructure and built into
images before it can reach `main`. The images must be scanned and pushed to ECR under an
immutable tag (rules 2 and 3). CI is also an attack surface: it holds the right to publish the
images production runs. The repository is private, so GitHub Advanced Security features
(CodeQL, dependency review, SARIF code scanning) are not available without a paid plan.

## Decision

1. **Two workflows, two required checks.** `ci.yml` covers code, chart, Terraform, security and
   the workflows themselves. `build.yml` builds every image. Each ends in an aggregate job
   (`CI passed`, `Images built`), so branch protection does not change when jobs are added.
2. **Pull requests build and scan every image.** Only `main` pushes. The OIDC build role trusts
   `ref:refs/heads/main` alone. The image that is pushed is the same local image that was
   scanned.
3. **Tags are the commit SHA** (`<sha>`; the web app `<sha>-<environment>`). The ECR
   repositories are immutable, and a re-run skips tags that already exist.
4. **Open-source scanners in place of GitHub Advanced Security.** The gates are:
   - gitleaks: the full history;
   - Trivy: the lockfile and the images. It fails only on HIGH/CRITICAL findings with a fix,
     because an unfixable advisory cannot be acted on;
   - Semgrep: static analysis;
   - checkov: Terraform;
   - actionlint and zizmor: the workflows.

   Each tool runs from a script that also works locally.

5. **Supply chain.** Actions are pinned to commit SHAs. Downloaded tools and service images are
   pinned by checksum or digest. Permissions are read-only by default. Tokens are not persisted
   after checkout. Dependabot runs weekly with a cooldown.
6. **The web image is built per environment.** This keeps the ADR-017 decision: its public URLs
   are compiled into the bundle. The URLs come from the Helm values the deploy uses, so the two
   cannot drift apart.

## Alternatives considered

- **CodeQL / dependency review**: better JavaScript data-flow analysis and native PR
  annotations, but they need GitHub Advanced Security on a private repository. They are easy to
  add if the repository goes public or the plan changes. Semgrep covers the common Node, React
  and Next.js mistakes in the meantime.
- **`pnpm audit` as the dependency gate**: it cannot ignore unfixable advisories. It currently
  fails on a build-tool transitive dependency (`braces`, via the ESLint Next.js plugin) for
  which no patched version exists. Trivy reads the same lockfile and applies the "fixable"
  rule.
- **Push first, scan in ECR (scan on push)**: still enabled as a second opinion, but a gate
  after the push lets vulnerable images into the registry the deploy reads from.
- **Runtime configuration for the web app** (one image for all environments): cleaner
  promotion, but every client module that reads the API URL would need to read it from the
  document at runtime. Building twice costs one extra matrix job.
- **Vendor setup actions for every tool** (Trivy, gitleaks...): convenient, but each one is
  more third-party code running with the job's token, and action tags have been rewritten in
  real attacks (`tj-actions/changed-files`, 2025). Release binaries with verified checksums
  need nothing but `curl`.

## Consequences

- A pull request runs 19 jobs. The matrix runs in parallel with the BuildKit cache, so
  the wall-clock time is set by the slowest image (the web app).
- Tool versions inside `install-tool` steps are not seen by Dependabot. Bumping one means
  updating its URL and checksum together.
- Images are not signed yet and carry no provenance attestation, because they are loaded into
  the runner's daemon to be scanned. Signing (cosign/Sigstore) and verification at admission
  belong to the security hardening phase.
- Repository settings (the `AWS_BUILD_ROLE_ARN` variable, branch protection, SHA-pinning
  enforcement) are documented in [docs/ci.md](../ci.md) and applied by an administrator.
