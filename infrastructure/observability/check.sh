#!/usr/bin/env bash
# Static checks for the observability configuration, the same locally and in CI:
# alert rules (syntax + unit tests), the collector configuration (validated by the collector
# binary itself, from the pinned image), and the dashboards (valid JSON, unique ids, only the
# provisioned data sources).
# Needs: promtool, jq, docker.
set -euo pipefail
cd "$(dirname "$0")"

COLLECTOR_IMAGE='ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-contrib:0.162.0@sha256:39923a8e431bd1f57be82411999d389fcfe40857492e4365456d97a4c1f74be6'

echo "── alert rules"
promtool check rules prometheus/alerts.yml
promtool test rules prometheus/alerts.test.yml
promtool check config --syntax-only prometheus/prometheus.yml

echo "── collector configuration"
docker run --rm -v "$PWD/otel-collector:/c:ro" "$COLLECTOR_IMAGE" \
  validate --config=/c/config.yaml --config=/c/redaction.yaml

echo "── dashboards"
for file in grafana/dashboards/*.json; do
  jq -e '
    (.uid | type == "string") and (.title | type == "string")
    and ([.panels[].id] | length == (unique | length))
    and ([.. | objects | select(has("datasource")) | .datasource | objects | .uid]
         | all(. == "prometheus" or . == "tempo" or . == "loki"))
  ' "$file" >/dev/null || { echo "invalid dashboard: $file" >&2; exit 1; }
  echo "ok $file"
done
