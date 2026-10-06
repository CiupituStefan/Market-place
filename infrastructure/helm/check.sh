#!/usr/bin/env bash
# Static checks for the Helm chart, the same locally and in CI:
# lint, template unit tests, then schema (kubeconform) and best-practice (kube-linter)
# validation of the rendered manifests for every environment; then the cluster's admission
# policies (Terraform modules/platform/charts/admission-policies) against good and bad pods.
# Needs: helm (+ helm-unittest plugin), kubeconform, kube-linter, kyverno (CLI).
set -euo pipefail

chart="$(cd "$(dirname "$0")/marketplace" && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

helm unittest "$chart"

deployable_kinds='kind: (ConfigMap|Service|ServiceAccount|Deployment|HorizontalPodAutoscaler|PodDisruptionBudget|NetworkPolicy|Ingress|ExternalSecret)'

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
  # The CI deploy role may manage only these kinds (Role `cse-deployer`, Terraform
  # modules/platform) and never Secrets: a new kind needs a matching RBAC change.
  unexpected="$(grep -E '^kind: ' "$out/$env.yaml" | sort -u | grep -vxE "$deployable_kinds" || true)"
  if [ -n "$unexpected" ]; then
    echo "The deploy role cannot manage: $unexpected" >&2
    exit 1
  fi
done

# Admission policies: rendered with a test registry, run against the pods in their tests/.
# (Provenance verification needs real signed images; see docs/security.md for the manual check.)
policies="$(cd "$(dirname "$0")/../terraform/modules/platform/charts/admission-policies" && pwd)"
echo "── admission policies"
helm lint --strict "$policies" --set registry=123456789012.dkr.ecr.eu-central-1.amazonaws.com \
  --set githubRepository=CiupituStefan/Market-place --set-json 'namespaces=["cse-staging"]'
mkdir -p "$out/kyverno"
cp "$policies"/tests/* "$out/kyverno/"
helm template p "$policies" --set registry=123456789012.dkr.ecr.eu-central-1.amazonaws.com \
  --set githubRepository=CiupituStefan/Market-place --set-json 'namespaces=["cse-staging"]' \
  --show-only templates/restrict-images.yaml > "$out/kyverno/policies.yaml"
kyverno test "$out/kyverno"

# The kafka-access job (Terraform modules/platform/charts/kafka-access), with the real files.
kafka_access="$(cd "$(dirname "$0")/../terraform/modules/platform/charts/kafka-access" && pwd)"
access_files="$(cd "$(dirname "$0")/../kafka" && pwd)"
echo "── kafka-access"
kafka_access_values=(--set region=eu-central-1 --set roleArn=arn:aws:iam::123456789012:role/test
  --set adminSecretName=AmazonMSK_cse-staging_kafka-admin --set bootstrapBrokers=b-1.example:9096
  --set revision=0123456789abcdef --set-json 'dataCidrs=["10.20.192.0/21"]'
  --set-file "files.apply\.sh=$access_files/apply.sh" --set-file "files.acls\.txt=$access_files/acls.txt"
  --set-file "files.topics\.txt=$access_files/topics.txt")
helm lint --strict "$kafka_access" "${kafka_access_values[@]}"
helm template kafka-access "$kafka_access" --namespace kafka-access "${kafka_access_values[@]}" > "$out/kafka-access.yaml"
kubeconform -strict -summary -kubernetes-version 1.33.0 \
  -schema-location default \
  -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
  "$out/kafka-access.yaml"
kube-linter lint "$out/kafka-access.yaml"
