#!/usr/bin/env bash
# Puts the repository's dashboards (infrastructure/observability/grafana/dashboards) into a
# Grafana, in the "CSE Keyboards" folder, overwriting what is there: dashboards are code.
# With PROMETHEUS_URL set, also creates/updates the Prometheus data source (uid "prometheus")
# the dashboards query, signing requests with the workspace's IAM role (Amazon Managed Grafana
# → Amazon Managed Service for Prometheus).
#
#   GRAFANA_URL=https://g-xxx.grafana-workspace.eu-central-1.amazonaws.com \
#   GRAFANA_TOKEN=... PROMETHEUS_URL=https://aps-workspaces.../workspaces/ws-.../ \
#   AWS_REGION=eu-central-1 scripts/grafana-sync.sh
#
# GRAFANA_AUTH=user:password instead of a token works for a local Grafana. Needs curl, jq.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${GRAFANA_URL:?GRAFANA_URL is required}"
url="${GRAFANA_URL%/}"
if [ -n "${GRAFANA_TOKEN:-}" ]; then
  auth=(-H "Authorization: Bearer $GRAFANA_TOKEN")
elif [ -n "${GRAFANA_AUTH:-}" ]; then
  auth=(-u "$GRAFANA_AUTH")
else
  echo "GRAFANA_TOKEN or GRAFANA_AUTH is required" >&2
  exit 2
fi

grafana() { # <method> <path> [json body]
  local response status
  response="$(curl -sS -X "$1" "${auth[@]}" -H 'Content-Type: application/json' \
    -w '\n%{http_code}' "$url$2" ${3:+--data-binary "$3"})"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
  if [ "$status" -ge 400 ]; then
    echo "Grafana $1 $2 → $status: $body" >&2
    return 1
  fi
}

if [ -n "${PROMETHEUS_URL:-}" ]; then
  : "${AWS_REGION:?AWS_REGION is required with PROMETHEUS_URL}"
  datasource="$(jq -n --arg url "$PROMETHEUS_URL" --arg region "$AWS_REGION" '{
    uid: "prometheus", name: "Prometheus", type: "prometheus", access: "proxy", url: $url,
    isDefault: true,
    jsonData: { sigV4Auth: true, sigV4AuthType: "ec2_iam_role", sigV4Region: $region,
                httpMethod: "POST", timeInterval: "15s" }
  }')"
  if grafana GET /api/datasources/uid/prometheus 2>/dev/null; then
    grafana PUT /api/datasources/uid/prometheus "$datasource"
  else
    grafana POST /api/datasources "$datasource"
  fi
  echo "data source: prometheus → $PROMETHEUS_URL"
fi

if ! grafana GET /api/folders/cse 2>/dev/null; then
  grafana POST /api/folders '{"uid":"cse","title":"CSE Keyboards"}'
fi

for file in infrastructure/observability/grafana/dashboards/*.json; do
  payload="$(jq '{dashboard: (. + {id: null}), folderUid: "cse", overwrite: true,
    message: "synced from the repository"}' "$file")"
  grafana POST /api/dashboards/db "$payload"
  echo "dashboard: $(jq -r .title "$file") → $(echo "$body" | jq -r .url)"
done
