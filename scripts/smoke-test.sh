#!/usr/bin/env bash
# Post-deploy smoke tests: read-only checks that the shop answers through its public edge.
# Safe against production (no orders, no sign-ups, no emails).
#   scripts/smoke-test.sh https://www.example.com https://api.example.com
# Plain http URLs (Docker Compose) skip the TLS/HSTS/redirect checks.
set -uo pipefail

web="${1:?usage: $0 <web-url> <api-url>}"
api="${2:?usage: $0 <web-url> <api-url>}"
web="${web%/}"
api="${api%/}"
# How long to wait for the first answer (load balancer target registration, DNS).
warmup_seconds="${SMOKE_WARMUP_SECONDS:-180}"

failures=0
body="$(mktemp)"
headers="$(mktemp)"
trap 'rm -f "$body" "$headers"' EXIT

pass() { printf '  ok    %s\n' "$1"; }
fail() {
  printf '  FAIL  %s\n' "$1"
  failures=$((failures + 1))
}

# request <url> [curl args...] -> sets $status; body and headers in files
request() {
  local url="$1"
  shift
  status="$(curl -sS --max-time 15 -o "$body" -D "$headers" -w '%{http_code}' "$@" "$url" 2>/dev/null)" ||
    status=000
}

expect_status() { # <name> <expected> <url> [curl args...]
  local name="$1" expected="$2" url="$3"
  shift 3
  request "$url" "$@"
  if [ "$status" = "$expected" ]; then pass "$name ($status)"; else fail "$name: expected $expected, got $status"; fi
}

header_present() { # <name> <header regex>
  if grep -qiE "^$2" "$headers"; then pass "$1"; else fail "$1: header $2 missing"; fi
}

body_matches() { # <name> <regex>
  if grep -qE "$2" "$body"; then pass "$1"; else fail "$1: body does not match $2"; fi
}

echo "Smoke testing $web and $api"

# 1. Wait until the gateway is ready (its dependencies included).
deadline=$((SECONDS + warmup_seconds))
until request "$api/health/ready" && [ "$status" = 200 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    fail "gateway ready within ${warmup_seconds}s (last status $status)"
    echo "Smoke tests failed: the API never became ready."
    exit 1
  fi
  sleep 5
done
pass "gateway ready"

# 2. Storefront.
expect_status "web health" 200 "$web/api/health"
expect_status "home page" 200 "$web/"
body_matches "home page is HTML" '<html'
header_present "nosniff on pages" 'x-content-type-options: *nosniff'
expect_status "shop page" 200 "$web/shop"

# 3. API: public reads reach their services and databases.
expect_status "product list" 200 "$api/api/v1/products?pageSize=1"
body_matches "product list is a page" '"(items|data)"'
expect_status "categories" 200 "$api/api/v1/categories"

# 4. API: the edge refuses what it must.
expect_status "unknown route" 404 "$api/api/v1/no-such-route"
body_matches "standard error body" '"error":\{"code":"[A-Z_]+","message":"[^"]*","requestId":"[^"]+"'
if grep -qiE 'at [A-Za-z.<>]+ \(|node_modules' "$body"; then fail "no stack traces in errors"; else pass "no stack traces in errors"; fi
expect_status "internal endpoints unreachable" 404 "$api/api/v1/inventory/internal/reservations"
expect_status "back office needs a session" 401 "$api/api/v1/admin/dashboard"
expect_status "cross-site write refused" 403 "$api/api/v1/cart/items" \
  -X POST -H 'Origin: https://attacker.example' -H 'Content-Type: application/json' -d '{}'

# 5. TLS at the edge (real environments only).
if [[ "$web" == https://* ]]; then
  request "$web/"
  header_present "HSTS" 'strict-transport-security: *max-age=[1-9]'
  host="${web#https://}"
  request "http://$host/"
  case "$status" in
    301 | 302 | 307 | 308)
      if grep -qiE "^location: *https://" "$headers"; then pass "http redirects to https ($status)"; else fail "http redirect target is not https"; fi
      ;;
    *) fail "http should redirect to https, got $status" ;;
  esac
fi

if [ "$failures" -gt 0 ]; then
  echo "Smoke tests failed: $failures check(s)."
  exit 1
fi
echo "Smoke tests passed."
