# Repository settings

GitHub settings do not live in the repository, so they are applied by a script that is:

- reviewed like code;
- idempotent: run it again after changing it;
- the record of what the settings should be.

```bash
gh auth login                       # as an admin of the repository
scripts/configure-github.sh         # CiupituStefan/Market-place
# optional: more production approvers, and the AWS role variables (Terraform outputs)
REVIEWERS="CiupituStefan alice" \
AWS_BUILD_ROLE_ARN=… STAGING_DEPLOY_ROLE_ARN=… PRODUCTION_DEPLOY_ROLE_ARN=… \
  scripts/configure-github.sh
```

Each control below works because the repository is public. On a private repository most of
them need a paid plan: Advanced Security, rulesets and environment reviewers.

## Merging into `main` (ruleset `main`)

| Rule                                                                                                                                                                                              | Why                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Pull request required. One approval from a code owner ([CODEOWNERS](../.github/CODEOWNERS)). Stale approvals are dismissed on push. The last push must be approved. All threads must be resolved. | Nothing reaches `main` (and so staging) unreviewed. Workflows, infrastructure, payments, auth and the gateway need the owner. |
| Required checks: `CI passed`, `Images built`, `Analyze (javascript-typescript)`, `Analyze (actions)`. Each must come from GitHub Actions, and the branch must be up to date.                      | A green build means this exact merge result passed. Another app cannot fake a check with the same name.                       |
| Code scanning: no new CodeQL error, no new high/critical security alert.                                                                                                                          | Findings block the merge instead of being read later.                                                                         |
| Squash merges only, linear history, signed commits, no force push, no deletion.                                                                                                                   | Every commit on `main` is a reviewed, attributable change. GitHub signs squash merges itself.                                 |

Repository admins can bypass the rules, but **only by merging a pull request** (`pull_request`
bypass mode), and each bypass is logged. A sole maintainer cannot approve their own pull
request, so without this they could never merge. Everyone else needs the owner's review.

## Security features

| Setting                               | Effect                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Secret scanning + **push protection** | A push containing a recognised credential is rejected before it is public, not just reported after. Works alongside gitleaks in CI.     |
| Dependabot alerts + security updates  | New advisories against the lockfile open pull requests. Weekly version updates come from [`dependabot.yml`](../.github/dependabot.yml). |
| Private vulnerability reporting       | Researchers report through a private advisory ([SECURITY.md](../SECURITY.md)), not a public issue.                                      |
| Code scanning                         | Results from CodeQL, Semgrep, Trivy (lockfile and every image), gitleaks, checkov, zizmor and Scorecard.                                |

## GitHub Actions

| Setting                                                                       | Effect                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Only allow-listed actions, **pinned to a full commit SHA**                    | GitHub-owned actions, plus the eight third-party ones the workflows use. A new action, or a pin by tag, does not run.       |
| Default `GITHUB_TOKEN` permission: read; Actions cannot approve pull requests | Every write permission is declared, and explained, in the job that needs it.                                                |
| Approval required for all outside contributors                                | A fork's workflow runs only after a maintainer has read the change. Fork runs have no secrets and a read-only token anyway. |

## Environments

| Environment  | Deploys from | Protection                       | Variable              |
| ------------ | ------------ | -------------------------------- | --------------------- |
| `staging`    | `main` only  | none: every merge deploys        | `AWS_DEPLOY_ROLE_ARN` |
| `production` | `main` only  | required reviewers (`REVIEWERS`) | `AWS_DEPLOY_ROLE_ARN` |

"Prevent self-review" is turned on only when there are at least two reviewers. With one
reviewer, the person who merged could never approve their own release, and production could
never be deployed.

The AWS roles trust only jobs bound to these environments (OIDC subject
`environment:<name>`). The environment rules (branch, reviewers) therefore also gate who can
obtain AWS credentials.

## Not in the script

- **The license.** The repository has none, which means all rights reserved. Choose one
  deliberately if others should be allowed to reuse the code.
- **The Scorecard badge.** It appears once `scorecard.yml` has run on `main`.
