# ADR-022: Public repository — GitHub-native security, signed provenance, settings as code

- Status: Accepted (amends ADR-020 and ADR-021)
- Date: 2026-10-06

## Context

ADR-020 and ADR-021 were written for a private repository on a free plan. Several controls
were unavailable or not enforceable there, so they were replaced or left as documentation:

- **No GitHub Advanced Security:** CodeQL, dependency review, code scanning (SARIF upload)
  and secret-scanning push protection could not be used.
- **No GitHub attestations:** the images carried no provenance, and signing was deferred.
- **No rulesets and no environment reviewers:** branch protection and production approval
  could only be described in the documentation, not enforced.

The repository is now public, which makes all of these available. It also means anyone can
open a pull request from a fork.

## Decision

1. **CodeQL** (`security-extended`) analyses the TypeScript and the workflows on every pull
   request and weekly. **Every other scanner** publishes SARIF to code scanning: Semgrep,
   Trivy (lockfile and each image), gitleaks, checkov, zizmor and Scorecard. The CI gates
   stay as they were, and the Security tab adds triage with a recorded reason. Suppressions
   already justified in the code (`nosemgrep`, checkov skips) arrive as dismissed alerts
   with their justification.
2. **Dependency review** on pull requests: new HIGH/CRITICAL advisories in any scope fail the
   check, licenses must be on an allow-list, and the OpenSSF score of new packages is shown.
3. **Signed build provenance and SBOM** for every pushed image: GitHub attestations, signed
   with Sigstore and logged in the public transparency log. **The deploy verifies them**
   before Helm runs. Each image must have been built by `build.yml`, on `main`, from the
   exact commit being deployed, on a GitHub-hosted runner. The deploy role gains read-only
   ECR access for this.
4. **Settings as code**: `scripts/configure-github.sh` applies:
   - the `main` ruleset: code-owner review, required checks bound to GitHub Actions, CodeQL
     gate, signed linear history;
   - secret scanning with push protection, Dependabot alerts and security updates, private
     vulnerability reporting;
   - an Actions allow-list with required SHA pinning and read-only default tokens;
   - approval for outside contributors' workflows;
   - the environments, with production reviewers.
5. **Public-facing policy**: `SECURITY.md` (private reporting), `CODEOWNERS` for the sensitive
   paths, and the OpenSSF Scorecard published.

## Alternatives considered

- **Keep only the open-source scanners** (ADR-020): they still run and still gate. Without
  code scanning, though, their findings live only in job logs, nobody can triage them, and
  CodeQL's data-flow analysis is missing.
- **Cosign keyless signing in the build**: equivalent cryptography. GitHub attestations add
  first-class verification (`gh attestation verify` with workflow, ref and commit
  constraints) and SBOM attestations without managing another tool.
- **Verification at admission** (Kyverno / Sigstore policy-controller) instead of in the
  deploy job: it also stops images started outside the pipeline. It is an in-cluster
  component, planned for security hardening (Phase 20). The deploy-time check covers the
  pipeline path now.
- **Prevent self-review on production with a single maintainer**: production would be
  undeployable. It is turned on automatically once there are two reviewers.

## Consequences

- A pull request that introduces a CodeQL error or a high/critical security alert cannot be
  merged. A false positive is dismissed in the Security tab with a reason, which is
  reviewable.
- Fork pull requests run every check with a read-only token. Their results appear in the job
  log, not in code scanning, and their workflows wait for a maintainer's approval.
- An image without valid attestations cannot be deployed. A build that pushed but failed to
  attest needs its tag deleted and the build re-run (documented in
  [deployment](../deployment.md)).
- Repository settings change through a reviewed script, not ad hoc clicks. Drift is
  corrected by re-running it.
