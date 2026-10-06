#!/usr/bin/env bash
# Security scans, the same locally and in CI. Each fails on a finding.
#   scripts/security-scan.sh [secrets|dependencies|code|all]
# With SARIF_DIR set, each scan also writes <SARIF_DIR>/<scan>.sarif for GitHub code scanning
# (CI uploads them; the pass/fail decision is the same either way).
# Needs: gitleaks, trivy, semgrep (versions pinned in .github/workflows/ci.yml).
# Reviewed false positives: .gitleaksignore (fingerprints), `nosemgrep: <rule>` with a reason.
set -euo pipefail
cd "$(dirname "$0")/.."

sarif_dir="${SARIF_DIR:-}"
[ -z "$sarif_dir" ] || mkdir -p "$sarif_dir"

secrets() {
  # Every commit, not just the working tree: deleting a secret does not un-leak it.
  gitleaks git --no-banner --redact \
    ${sarif_dir:+--report-format sarif --report-path "$sarif_dir/secrets.sarif"} .
}

dependencies() {
  # Lockfile vulnerabilities that have a fixed version (an unfixable advisory cannot be acted
  # on and would only teach people to ignore the job). Images are scanned in build.yml.
  local report status=0
  report="$(mktemp)"
  trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
    --no-progress --format json --output "$report" pnpm-lock.yaml || status=$?
  trivy convert --format table "$report"
  [ -z "$sarif_dir" ] || trivy convert --format sarif --output "$sarif_dir/dependencies.sarif" "$report"
  rm -f "$report"
  return "$status"
}

code() {
  semgrep scan --metrics=off --error \
    --config p/typescript --config p/nodejsscan --config p/react --config p/nextjs \
    --severity ERROR --severity WARNING \
    --exclude '**/*.test.ts' --exclude '**/*.test.tsx' --exclude '**/test/**' \
    ${sarif_dir:+--sarif-output="$sarif_dir/code.sarif"} \
    apps packages
}

case "${1:-all}" in
  secrets) secrets ;;
  dependencies) dependencies ;;
  code) code ;;
  all) secrets && dependencies && code ;;
  *)
    echo "usage: $0 [secrets|dependencies|code|all]" >&2
    exit 2
    ;;
esac
