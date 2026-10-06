#!/usr/bin/env bash
# Makes the cluster's topics and ACLs match topics.txt and acls.txt (generated from
# packages/events/src/access.ts). Runs as the Kafka admin user, in the apache/kafka image:
# as a Job in the cluster (Terraform modules/platform, chart kafka-access) and in test.sh.
#
#   KAFKA_BOOTSTRAP           host:port,...
#   KAFKA_ADMIN_USERNAME/_PASSWORD
#   KAFKA_SECURITY_PROTOCOL   SASL_SSL (default, MSK) or SASL_PLAINTEXT (tests)
#   KAFKA_ACCESS_DIR          directory with topics.txt and acls.txt (default: this script's)
#
# Declarative: ACLs in the cluster that acls.txt does not list are removed (except the admin
# user's own), so a permission dropped from access.ts is revoked on the next run. Idempotent.
set -euo pipefail

bin=/opt/kafka/bin
dir="${KAFKA_ACCESS_DIR:-$(cd "$(dirname "$0")" && pwd)}"
admin="User:${KAFKA_ADMIN_USERNAME:?}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

umask 077
cat > "$work/client.properties" <<EOF
security.protocol=${KAFKA_SECURITY_PROTOCOL:-SASL_SSL}
sasl.mechanism=SCRAM-SHA-512
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="${KAFKA_ADMIN_USERNAME}" password="${KAFKA_ADMIN_PASSWORD:?}";
EOF
kafka() { "$bin/$1" --bootstrap-server "${KAFKA_BOOTSTRAP:?}" --command-config "$work/client.properties" "${@:2}"; }
acls() { kafka kafka-acls.sh "$@" >/dev/null; }
entries() { grep -vE '^\s*(#|$)' "$1"; }

# 1. The admin user's own rights first. On MSK, until the cluster resource has an ACL any
#    authenticated user may manage ACLs (allow.everyone.if.no.acl.found); this closes that.
acls --add --allow-principal "$admin" --operation All --cluster
acls --add --allow-principal "$admin" --operation All --topic '*'
acls --add --allow-principal "$admin" --operation All --group '*'
acls --add --allow-principal "$admin" --operation All --transactional-id '*'

# 2. Topics (partitions and replication: the broker defaults).
existing="$(kafka kafka-topics.sh --list)"
while read -r topic; do
  if ! grep -qxF "$topic" <<<"$existing"; then
    # (stderr: a warning about dots in topic names, which ours use on purpose)
    kafka kafka-topics.sh --create --if-not-exists --topic "$topic" >/dev/null 2>"$work/err" ||
      { cat "$work/err" >&2; exit 1; }
    echo "created topic: $topic"
  fi
done < <(entries "$dir/topics.txt")

# 3. ACLs. Current ones, one per line in acls.txt's format:
#    principal resource-type pattern-type name operation [permission host]
kafka kafka-acls.sh --list | awk '
  /^Current ACLs for resource/ {
    match($0, /resourceType=[A-Z_]+/); type = substr($0, RSTART + 13, RLENGTH - 13)
    match($0, /name=[^,]+/);           name = substr($0, RSTART + 5, RLENGTH - 5)
    match($0, /patternType=[A-Z]+/);   pattern = substr($0, RSTART + 12, RLENGTH - 12)
    next
  }
  /principal=/ {
    match($0, /principal=[^,]+/);      principal = substr($0, RSTART + 10, RLENGTH - 10)
    match($0, /host=[^,]+/);           host = substr($0, RSTART + 5, RLENGTH - 5)
    match($0, /operation=[A-Z_]+/);    op = substr($0, RSTART + 10, RLENGTH - 10)
    match($0, /permissionType=[A-Z]+/); perm = substr($0, RSTART + 15, RLENGTH - 15)
    line = principal " " type " " pattern " " name " " op
    if (perm != "ALLOW" || host != "*") line = line " " perm " " host
    print line
  }' | { grep -v "^$admin " || true; } | sort -u > "$work/current"
entries "$dir/acls.txt" | sort -u > "$work/desired"

resource() { # type name -> kafka-acls resource flags
  case "$1" in
    TOPIC) echo "--topic $2" ;;
    GROUP) echo "--group $2" ;;
    TRANSACTIONAL_ID) echo "--transactional-id $2" ;;
    CLUSTER) echo "--cluster" ;;
    *) echo "unsupported resource type $1" >&2; return 1 ;;
  esac
}
change() { # add|remove principal type pattern name operation [permission host]
  local kind=allow flags
  if [ "${7:-ALLOW}" = DENY ]; then kind=deny; fi
  flags="$(resource "$3" "$5")"
  # shellcheck disable=SC2086 # flags is a word list
  acls "--$1" --force "--$kind-principal" "$2" "--$kind-host" "${8:-*}" --operation "$6" \
    --resource-pattern-type "${4,,}" $flags
}

removed=0
added=0
while read -r line; do
  # shellcheck disable=SC2086
  change remove $line
  echo "removed: $line"
  removed=$((removed + 1))
done < <(comm -23 "$work/current" "$work/desired")
while read -r line; do
  # shellcheck disable=SC2086
  change add $line
  added=$((added + 1))
done < <(comm -13 "$work/current" "$work/desired")

echo "topics: $(entries "$dir/topics.txt" | wc -l | tr -d ' '), ACLs: $(wc -l < "$work/desired" | tr -d ' ') (added $added, removed $removed)"
