#!/usr/bin/env bash
# Switches the VM's payments from the built-in mock to Stripe (docs/deploy-google-cloud.md):
#   sudo deploy/gcp-vm/enable-stripe.sh
# Asks for the keys (hidden: they stay out of the shell history, logs and Git), creates the
# webhook endpoint https://<API_DOMAIN>/api/v1/payments/webhook in that Stripe account, writes
# the values to deploy/gcp-vm/.env and restarts payment-service. Run it again with live keys
# to go live; run `sudo deploy/gcp-vm/enable-stripe.sh --mock` to switch back to the mock.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="$here/.env"
# Same API version as the stripe SDK in payment-service, so webhook payloads match its requests.
api_version='2026-09-30.endive'
events=(
  payment_intent.succeeded
  payment_intent.payment_failed
  payment_intent.processing
  payment_intent.canceled
  refund.created
  refund.updated
  refund.failed
)

[ -f "$env_file" ] || { echo "No $env_file: run setup-vm.sh first." >&2; exit 1; }

# Replaces KEY=... in .env (or appends it). Values are written with printf, never echoed.
set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$env_file" >"$tmp" || true
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  sudo install -m 600 "$tmp" "$env_file"
  rm -f "$tmp"
}

if [ "${1:-}" = "--mock" ]; then
  set_env PAYMENT_PROVIDER mock
  "$here/dc" up -d --wait payment-service
  echo "Payments use the mock provider again."
  exit 0
fi

read -rsp 'Stripe secret or restricted key (sk_/rk_...): ' secret_key
echo
read -rp 'Stripe publishable key (pk_...): ' publishable_key
[[ "$secret_key" =~ ^(sk|rk)_(test|live)_ ]] || { echo 'That is not a secret/restricted key.' >&2; exit 1; }
[[ "$publishable_key" =~ ^pk_(test|live)_ ]] || { echo 'That is not a publishable key.' >&2; exit 1; }
mode="${secret_key#*_}"; mode="${mode%%_*}"
[[ "$publishable_key" == pk_${mode}_* ]] || { echo "Keys are from different modes." >&2; exit 1; }

api_domain="$(grep '^API_DOMAIN=' "$env_file" | cut -d= -f2)"
url="https://${api_domain}/api/v1/payments/webhook"
# The key goes to curl on stdin, not on its command line (visible to other processes).
stripe() {
  printf 'user = "%s:"\n' "$secret_key" |
    curl -sS --fail-with-body -K - -H "Stripe-Version: ${api_version}" "$@"
}

existing="$(stripe 'https://api.stripe.com/v1/webhook_endpoints?limit=100' |
  python3 -c "import json,sys; print(next((w['id'] for w in json.load(sys.stdin)['data'] if w['url']==sys.argv[1]), ''))" "$url")"
if [ -n "$existing" ]; then
  # Stripe shows a signing secret only when the endpoint is created.
  echo "A webhook endpoint for $url already exists ($existing)."
  read -rsp 'Its signing secret (whsec_..., Dashboard > Developers > Webhooks): ' webhook_secret
  echo
else
  args=(-d "url=${url}" -d "api_version=${api_version}" -d 'description=CSE Keyboards payment-service')
  for event in "${events[@]}"; do args+=(-d "enabled_events[]=${event}"); done
  webhook_secret="$(stripe https://api.stripe.com/v1/webhook_endpoints "${args[@]}" |
    python3 -c "import json,sys; print(json.load(sys.stdin)['secret'])")"
  echo "Created the webhook endpoint $url."
fi
[[ "$webhook_secret" =~ ^whsec_ ]] || { echo 'No webhook signing secret.' >&2; exit 1; }

set_env PAYMENT_PROVIDER stripe
set_env STRIPE_SECRET_KEY "$secret_key"
set_env STRIPE_PUBLISHABLE_KEY "$publishable_key"
set_env STRIPE_WEBHOOK_SECRET "$webhook_secret"
unset secret_key webhook_secret

"$here/dc" up -d --wait payment-service
echo "Payments now go through Stripe ($mode mode)."
[ "$mode" = test ] && echo "Test card: 4242 4242 4242 4242, any future date, any CVC."
