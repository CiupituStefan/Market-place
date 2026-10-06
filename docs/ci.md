# Continuous integration

Two workflows run on every pull request and on `main`. Each one ends in a single summary
check, and branch protection requires those two checks.

| Workflow                                      | Jobs                                                   | Required check |
| --------------------------------------------- | ------------------------------------------------------ | -------------- |
| [`ci.yml`](../.github/workflows/ci.yml)       | `verify`, `helm`, `terraform`, `security`, `workflows` | `CI passed`    |
| [`build.yml`](../.github/workflows/build.yml) | one `image` job per image (12), then the summary       | `Images built` |

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
- **Service images are pinned by digest.**
- **Dependabot runs weekly** for npm, Actions, Docker base images and Terraform providers, with
  a 7-day cooldown on new releases.

## Repository settings (once)

- **Variable** `AWS_BUILD_ROLE_ARN`: the `build_role_arn` output of
  `infrastructure/terraform/stacks/global`. This is not a secret.
- **Branch protection on `main`:**
  - require pull requests;
  - require the checks `CI passed` and `Images built`;
  - require branches to be up to date;
  - no force pushes.
- **Actions settings:**
  - allow only actions pinned to a full commit SHA;
  - set the default workflow permissions to read.

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
