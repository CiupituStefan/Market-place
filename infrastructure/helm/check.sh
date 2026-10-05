#!/usr/bin/env bash
# Static checks for the Helm chart, the same locally and in CI:
# lint, template unit tests, then schema (kubeconform) and best-practice (kube-linter)
# validation of the rendered manifests for every environment.
# Needs: helm (+ helm-unittest plugin), kubeconform, kube-linter.
set -euo pipefail

chart="$(cd "$(dirname "$0")/marketplace" && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

helm unittest "$chart"

for env in staging production; do
  values=(-f "$chart/values-$env.yaml" -f "$chart/ci/example-values.yaml")
  echo "── $env"
  helm lint --strict "$chart" "${values[@]}"
  helm template marketplace "$chart" --namespace "cse-$env" "${values[@]}" > "$out/$env.yaml"
  kubeconform -strict -summary -kubernetes-version 1.33.0 \
    -schema-location default \
    -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
    "$out/$env.yaml"
  kube-linter lint --config "$chart/.kube-linter.yaml" "$out/$env.yaml"
done
