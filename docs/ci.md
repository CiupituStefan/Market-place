# Continuous integration

Three workflows run on every pull request and on `main`; the `main` ruleset requires their
checks ([repository settings](repository-settings.md)). Every scanner also publishes its
results to **code scanning** (the repository's Security tab and annotations on the pull
request), so findings are tracked, triaged and dismissed with a reason in one place.

| Workflow                                        | Jobs                                                                           | Required checks                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [`ci.yml`](../.github/workflows/ci.yml)         | `verify`, `helm`, `terraform`, `security`, `workflows`, `dependency-review`    | `CI passed`                                            |
| [`build.yml`](../.github/workflows/build.yml)   | one `image` job per image (12), then the summary                               | `Images built`                                         |
| [`codeql.yml`](../.github/workflows/codeql.yml) | CodeQL for TypeScript and for the workflows (`security-extended`), also weekly | `Analyze (javascript-typescript)`, `Analyze (actions)` |

[`scorecard.yml`](../.github/workflows/scorecard.yml) runs the OpenSSF Scorecard weekly and on
`main` (supply-chain posture of the repository itself; published score in the README).

## What runs

**verify** — `pnpm format:check`, then `turbo run lint typecheck test build` against real
PostgreSQL, Redis and Kafka service containers (overselling, deadlocks and `SKIP LOCKED` need a
real database; outbox → Kafka → consumer → DLQ needs a real broker). Every service's migrations
are applied to its own database. The job fails if a schema changed without a committed
migration. Docker Compose is validated too.

**helm** — `infrastructure/helm/check.sh`: helm-unittest, `helm lint --strict`, kubeconform
(Kubernetes and CRD schemas) and kube-linter, for staging and production.

**terraform** — `infrastructure/terraform/check.sh`:

- `fmt` and `validate`;
- `terraform test` against mock providers;
- tflint and checkov.

It needs no AWS credentials.

**security** — `scripts/security-scan.sh`:

- **gitleaks** scans the whole Git history for secrets. Deleting a secret does not un-leak it.
- **Trivy** checks the lockfile for HIGH/CRITICAL vulnerabilities that have a fixed version.
- **Semgrep** runs the TypeScript, Node.js, React and Next.js rule packs.

**dependency-review** (pull requests) — what the pull request adds to the lockfile: fails on
HIGH/CRITICAL advisories in any scope and on licenses outside the allow-list
([config](../.github/dependency-review-config.yml)), and shows the OpenSSF score of new
packages.

**CodeQL** — data-flow analysis (user input reaching queries, redirects, file paths, HTML,
logs...), complementing Semgrep's patterns. The ruleset blocks merging a pull request that
introduces a CodeQL error or a high/critical security alert.

**workflows** — actionlint, plus zizmor in its strictest (`auditor`) mode for workflow
security:

- template injection;
- excessive permissions;
- unpinned actions and images;
- credential persistence.

**image** (build.yml) runs once per image:

1. Build with BuildKit and the GitHub Actions cache.
2. Scan the built image with Trivy. The job fails on fixable HIGH/CRITICAL vulnerabilities and
   on secrets baked into layers.
3. Keep a CycloneDX SBOM for 90 days.
4. **On `main` only:** assume the build role through GitHub OIDC and push the image to ECR
   under the commit SHA.
5. **On `main` only:** sign two attestations for the pushed digest with Sigstore (recorded in
   the public transparency log): SLSA **build provenance** (this workflow, this commit, `main`,
   a GitHub-hosted runner) and the **SBOM**. The deploy verifies both before anything runs
   ([deployment](deployment.md)). Anyone can check an image:
   `gh attestation verify oci://<registry>/cse/<image>:<sha> --repo CiupituStefan/Market-place`.

The scanned image is the one that gets pushed. The `latest` tag is never used.

On `main` the same run then deploys the commit to staging, and production follows after
approval: see [deployment](deployment.md).

The web app compiles its public URLs into the browser bundle, so it is built once per
environment as `web:<sha>-staging` and `web:<sha>-production`. Its hosts come from the
environment's Helm values (`global.domains`), the same file the deploy uses. The chart picks
the matching tag (`imagePerEnvironment`).

## Supply-chain rules

- **Third-party actions are pinned to a commit SHA**, with the version in a comment.
  Dependabot updates both. A moved tag cannot change what runs.
- **Tools are pinned by checksum.** They are downloaded through
  [`install-tool`](../.github/actions/install-tool/action.yml), which refuses an archive whose
  SHA-256 differs from the one committed. Dependabot does not track these: bump the version
  and checksum together. The checksums come from the release's own checksum file.
- **Least privilege.** Workflows default to `contents: read`. Checkouts do not persist the
  token. Only the image job gets an OIDC token, and the AWS role behind it trusts `main` alone,
  so a pull request (including one from a fork) cannot push images.
- **Forks.** Pull requests from forks run with a read-only token and no secrets, and outside
  contributors' workflows wait for a maintainer's approval. Their scan results stay in the
  job log, because a read-only token cannot publish to code scanning.
- **Service images are pinned by digest.**
- **Dependabot runs weekly** for npm, Actions, Docker base images and Terraform providers, with
  a 7-day cooldown on new releases.

## Repository settings

Applied by [`scripts/configure-github.sh`](../scripts/configure-github.sh) and explained in
[repository settings](repository-settings.md): the `main` ruleset, secret scanning with push
protection, the Actions allow-list with SHA pinning, approval for outside contributors'
workflows, and the `AWS_BUILD_ROLE_ARN` variable.

## Running the same checks locally

```bash
pnpm check                              # verify (needs the Compose infrastructure for real-DB tests)
infrastructure/helm/check.sh            # helm, helm-unittest plugin, kubeconform, kube-linter
infrastructure/terraform/check.sh       # terraform, tflint, checkov
scripts/security-scan.sh                # gitleaks, trivy, semgrep
actionlint && zizmor --persona auditor .github
```

A reviewed false positive is recorded where it occurs, never by loosening a whole rule:

- gitleaks: its fingerprint in `.gitleaksignore`;
- Semgrep: `// nosemgrep: <rule>` on the line, with a comment explaining why;
- checkov: `#checkov:skip=<id>:<reason>`.
