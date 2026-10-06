#!/usr/bin/env bash
# End-to-end tests on the whole shop in Docker Compose, the same locally and in CI:
#   scripts/e2e.sh                 start the stack (images must be built), test, keep it running
#   scripts/e2e.sh --build --down  build the images first, stop and delete everything after
# Extra arguments after `--` go to Playwright, e.g. `scripts/e2e.sh -- --grep checkout`.
# Needs Docker and, for the browser, `pnpm --filter @market/e2e exec playwright install chromium`
# (or E2E_CHROMIUM_PATH pointing at a Chromium). Reports: e2e/playwright-report.
set -euo pipefail

cd "$(dirname "$0")/.."
build=false
down=false
while [ $# -gt 0 ]; do
  case "$1" in
    --build) build=true ;;
    --down) down=true ;;
    --) shift; break ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

# Every journey comes from this machine's address: the gateway's per-address rate limits (tested
# on their own in apps/api-gateway) would refuse the parallel sign-ins.
export RATE_LIMIT_ENABLED="${RATE_LIMIT_ENABLED:-false}"

# Extra compose files: the standard COMPOSE_FILE variable (colon-separated).
compose=(docker compose)
logs_dir=e2e/test-results/compose-logs

finish() {
  status=$?
  if [ "$status" -ne 0 ]; then
    # What the services said while the tests ran: the first place to look after a failure.
    mkdir -p "$logs_dir"
    for service in $("${compose[@]}" config --services); do
      "${compose[@]}" logs --no-color --timestamps "$service" > "$logs_dir/$service.log" 2>&1 || true
    done
    echo "Service logs: $logs_dir"
  fi
  if $down; then "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; fi
  exit "$status"
}
trap finish EXIT

if $build; then "${compose[@]}" build; fi

echo "── starting the stack"
"${compose[@]}" up -d

# The seed jobs run once; the shop is ready when they all succeeded and the gateway and the
# storefront answer.
deadline=$((SECONDS + ${E2E_START_TIMEOUT:-600}))
for job in seed-admin seed-catalog seed-inventory seed-discounts storage-init; do
  until [ "$(docker inspect -f '{{.State.Status}}' "$("${compose[@]}" ps -aq "$job")" 2>/dev/null)" = exited ]; do
    if [ "$SECONDS" -ge "$deadline" ]; then echo "$job did not finish in time" >&2; exit 1; fi
    sleep 3
  done
  code="$(docker inspect -f '{{.State.ExitCode}}' "$("${compose[@]}" ps -aq "$job")")"
  if [ "$code" != 0 ]; then echo "$job failed (exit $code)" >&2; exit 1; fi
  echo "   $job done"
done
for url in http://localhost:4000/health/ready http://localhost:3000/api/health; do
  until curl -fsS -o /dev/null "$url"; do
    if [ "$SECONDS" -ge "$deadline" ]; then echo "$url not ready in time" >&2; exit 1; fi
    sleep 3
  done
done
echo "── stack ready"

pnpm --filter @market/e2e exec playwright test "$@"
