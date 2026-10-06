#!/usr/bin/env bash
# Static checks for the Terraform code, the same locally and in CI. Nothing here talks to AWS:
# no backend, no credentials; module and stack tests run against mock providers.
# Needs: terraform, tflint (+ aws ruleset, `tflint --init`), checkov.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
cd "$root"

echo "── format"
terraform fmt -check -recursive -diff

# Root configurations: validating them validates every module they call (modules alone lack
# provider configurations, e.g. the us-east-1 alias). Then the tests, against mock providers.
for dir in bootstrap stacks/*/; do
  dir="${dir%/}"
  echo "── $dir"
  terraform -chdir="$dir" init -backend=false -input=false -no-color >/dev/null
  terraform -chdir="$dir" validate -no-color
done

for tests in stacks/*/tests modules/*/tests; do
  [ -d "$tests" ] || continue
  dir="$(dirname "$tests")"
  echo "── test $dir"
  terraform -chdir="$dir" init -backend=false -input=false -no-color >/dev/null
  terraform -chdir="$dir" test -no-color
done

echo "── tflint"
tflint --init --config "$root/.tflint.hcl" >/dev/null
tflint --recursive --config "$root/.tflint.hcl"

echo "── checkov"
# With SARIF_DIR set, also writes $SARIF_DIR/results_sarif.sarif for GitHub code scanning.
checkov --directory "$root" --framework terraform --quiet --compact \
  --skip-path '\.terraform' --download-external-modules false \
  ${SARIF_DIR:+--output cli --output sarif --output-file-path "$SARIF_DIR"}
