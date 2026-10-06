#!/usr/bin/env bash
# Applies the repository's GitHub settings: security features, Actions policy, the `main`
# ruleset and the deployment environments. Idempotent: run it again after changing it.
#
#   gh auth login                                   # an admin of the repository
#   scripts/configure-github.sh                     # CiupituStefan/Market-place
#   REVIEWERS="alice bob" scripts/configure-github.sh owner/repo
#
# Optional, to also set the AWS role variables (Terraform outputs; not secrets):
#   AWS_BUILD_ROLE_ARN=...  STAGING_DEPLOY_ROLE_ARN=...  PRODUCTION_DEPLOY_ROLE_ARN=...
#
# Needs: gh (authenticated, admin), jq. See docs/repository-settings.md for the reasoning.
set -euo pipefail

repo="${1:-CiupituStefan/Market-place}"
owner="${repo%%/*}"
# Who approves production deployments (GitHub logins). Defaults to the repository owner.
read -r -a reviewers <<<"${REVIEWERS:-$owner}"

api() { gh api -H 'X-GitHub-Api-Version: 2022-11-28' "$@"; }
step() { printf '\n── %s\n' "$1"; }

# GitHub Actions' app id: required checks must come from Actions, not any app reporting the name.
actions_app=15368

step "repository: squash merges only, delete merged branches, auto-merge"
jq -n '{
  allow_squash_merge: true, allow_merge_commit: false, allow_rebase_merge: false,
  squash_merge_commit_title: "PR_TITLE", squash_merge_commit_message: "PR_BODY",
  delete_branch_on_merge: true, allow_auto_merge: true, allow_update_branch: true,
  web_commit_signoff_required: false
}' | api --method PATCH "repos/$repo" --input - >/dev/null

step "security: secret scanning + push protection, Dependabot alerts and fixes, private reports"
jq -n '{security_and_analysis: {
  secret_scanning: {status: "enabled"},
  secret_scanning_push_protection: {status: "enabled"},
  dependabot_security_updates: {status: "enabled"}
}}' | api --method PATCH "repos/$repo" --input - >/dev/null
api --method PUT "repos/$repo/vulnerability-alerts" >/dev/null
api --method PUT "repos/$repo/private-vulnerability-reporting" >/dev/null

step "actions: allow-listed actions pinned by SHA, read-only token, approve outside contributors"
jq -n '{enabled: true, allowed_actions: "selected", sha_pinning_required: true}' |
  api --method PUT "repos/$repo/actions/permissions" --input - >/dev/null
jq -n '{
  github_owned_allowed: true,
  verified_allowed: false,
  patterns_allowed: [
    "pnpm/action-setup@*",
    "hashicorp/setup-terraform@*",
    "terraform-linters/setup-tflint@*",
    "docker/setup-buildx-action@*",
    "docker/build-push-action@*",
    "aws-actions/configure-aws-credentials@*",
    "aws-actions/amazon-ecr-login@*",
    "ossf/scorecard-action@*"
  ]
}' | api --method PUT "repos/$repo/actions/permissions/selected-actions" --input - >/dev/null
jq -n '{default_workflow_permissions: "read", can_approve_pull_request_reviews: false}' |
  api --method PUT "repos/$repo/actions/permissions/workflow" --input - >/dev/null
jq -n '{approval_policy: "all_external_contributors"}' |
  api --method PUT "repos/$repo/actions/permissions/fork-pr-contributor-approval" --input - >/dev/null

step "ruleset: main"
ruleset="$(jq -n --argjson app "$actions_app" '{
  name: "main",
  target: "branch",
  enforcement: "active",
  conditions: {ref_name: {include: ["~DEFAULT_BRANCH"], exclude: []}},
  # Repository admins may bypass, only by merging a pull request (a solo maintainer cannot
  # approve their own); the bypass is recorded. Everyone else needs a code owner approval.
  bypass_actors: [{actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request"}],
  rules: [
    {type: "deletion"},
    {type: "non_fast_forward"},
    {type: "required_linear_history"},
    {type: "required_signatures"},
    {type: "pull_request", parameters: {
      required_approving_review_count: 1,
      require_code_owner_review: true,
      dismiss_stale_reviews_on_push: true,
      require_last_push_approval: true,
      required_review_thread_resolution: true,
      allowed_merge_methods: ["squash"]
    }},
    {type: "required_status_checks", parameters: {
      strict_required_status_checks_policy: true,
      do_not_enforce_on_create: false,
      required_status_checks: [
        {context: "CI passed", integration_id: $app},
        {context: "Images built", integration_id: $app},
        {context: "Analyze (javascript-typescript)", integration_id: $app},
        {context: "Analyze (actions)", integration_id: $app}
      ]
    }},
    {type: "code_scanning", parameters: {code_scanning_tools: [
      {tool: "CodeQL", alerts_threshold: "errors", security_alerts_threshold: "high_or_higher"}
    ]}}
  ]
}')"
id="$(api "repos/$repo/rulesets" --jq '.[] | select(.name == "main") | .id' | head -n 1)"
if [ -n "$id" ]; then
  echo "$ruleset" | api --method PUT "repos/$repo/rulesets/$id" --input - >/dev/null
else
  echo "$ruleset" | api --method POST "repos/$repo/rulesets" --input - >/dev/null
fi

step "environments: staging and production deploy from main only; production needs approval"
reviewer_ids="$(for login in "${reviewers[@]}"; do api "users/$login" --jq '{type: "User", id: .id}'; done | jq -s .)"
# With a single reviewer, preventing self-review would block every production deploy.
prevent_self_review="$([ "${#reviewers[@]}" -gt 1 ] && echo true || echo false)"
for env in staging production; do
  if [ "$env" = production ]; then
    body="$(jq -n --argjson reviewers "$reviewer_ids" --argjson self "$prevent_self_review" '{
      wait_timer: 0, prevent_self_review: $self, reviewers: $reviewers,
      deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}}')"
  else
    body='{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}'
  fi
  echo "$body" | api --method PUT "repos/$repo/environments/$env" --input - >/dev/null
  if ! api "repos/$repo/environments/$env/deployment-branch-policies" \
    --jq '.branch_policies[] | select(.name == "main" and .type == "branch") | .id' | grep -q .; then
    jq -n '{name: "main", type: "branch"}' |
      api --method POST "repos/$repo/environments/$env/deployment-branch-policies" --input - >/dev/null
  fi
done

step "variables (only those provided)"
set_variable() { # <path> <name> <value>
  local path="$1" name="$2" value="$3"
  [ -n "$value" ] || return 0
  if api "$path/variables/$name" >/dev/null 2>&1; then
    jq -n --arg n "$name" --arg v "$value" '{name: $n, value: $v}' |
      api --method PATCH "$path/variables/$name" --input - >/dev/null
  else
    jq -n --arg n "$name" --arg v "$value" '{name: $n, value: $v}' |
      api --method POST "$path/variables" --input - >/dev/null
  fi
  echo "set $name ($path)"
}
set_variable "repos/$repo" AWS_BUILD_ROLE_ARN "${AWS_BUILD_ROLE_ARN:-}"
set_variable "repos/$repo/environments/staging" AWS_DEPLOY_ROLE_ARN "${STAGING_DEPLOY_ROLE_ARN:-}"
set_variable "repos/$repo/environments/production" AWS_DEPLOY_ROLE_ARN "${PRODUCTION_DEPLOY_ROLE_ARN:-}"

printf '\nDone. Review: https://github.com/%s/settings\n' "$repo"
