#!/usr/bin/env bash
# Security scans, the same locally and in CI. Each fails on a finding.
#   scripts/security-scan.sh [secrets|dependencies|code|all]
# Needs: gitleaks, trivy, semgrep (versions pinned in .github/workflows/ci.yml).
# Reviewed false positives: .gitleaksignore (fingerprints), `nosemgrep: <rule>` with a reason.
set -euo pipefail
cd "$(dirname "$0")/.."

secrets() {
  # Every commit, not just the working tree: deleting a secret does not un-leak it.
  gitleaks git --no-banner --redact .
}

dependencies() {
  # Lockfile vulnerabilities that have a fixed version (an unfixable advisory cannot be acted
  # on and would only teach people to ignore the job). Images are scanned in build.yml.
  trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
    --no-progress pnpm-lock.yaml
}

code() {
  semgrep scan --metrics=off --error \
    --config p/typescript --config p/nodejsscan --config p/react --config p/nextjs \
    --severity ERROR --severity WARNING \
    --exclude '**/*.test.ts' --exclude '**/*.test.tsx' --exclude '**/test/**' \
    apps packages
}

case "${1:-all}" in
  secrets) secrets ;;
  dependencies) dependencies ;;
  code) code ;;
  all) secrets && dependencies && code ;;
  *) echo "usage: $0 [secrets|dependencies|code|all]" >&2; exit 2 ;;
esac
