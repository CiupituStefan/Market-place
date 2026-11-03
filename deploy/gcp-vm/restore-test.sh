#!/usr/bin/env bash
# Proves the latest database backup can be restored, without touching the VM
# (docs/deploy-google-cloud.md). Run in Cloud Shell (it has gcloud and Docker), at least quarterly:
#   deploy/gcp-vm/restore-test.sh [gs://bucket]      default bucket: gs://cse-keyboard-db-backups
# Downloads the newest backup, checks its checksums, restores every database into a throwaway
# PostgreSQL container and prints the tables and rows found in each. Keep the output as the
# record of the test.
set -euo pipefail

bucket="${1:-gs://cse-keyboard-db-backups}"
image='mirror.gcr.io/library/postgres:16.15-alpine' # the version the VM runs
container="cse-restore-test-$$"

latest="$(gcloud storage ls "$bucket/" | sort | tail -1)"
[ -n "$latest" ] || { echo "no backups in $bucket" >&2; exit 1; }
work="$(mktemp -d)"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

echo "Backup: $latest"
gcloud storage cp --quiet "${latest}*" "$work/"
(cd "$work" && sha256sum --check --quiet SHA256SUMS) && echo "Checksums: OK"

docker run -d --name "$container" -e POSTGRES_PASSWORD=restore-test -v "$work:/backup:ro" "$image" >/dev/null
until docker exec "$container" pg_isready -U postgres -q; do sleep 1; done
sleep 2 # the entrypoint restarts the server once after initialising

psql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
psql -d postgres -f /backup/globals.sql >/dev/null 2>&1 || true # roles; "postgres" already exists
printf '\n%-14s %7s %9s\n' database tables rows
for dump in "$work"/*.dump; do
  db="$(basename "$dump" .dump)"
  psql -d postgres -c "CREATE DATABASE \"$db\""
  docker exec "$container" pg_restore -U postgres -d "$db" --no-owner --exit-on-error "/backup/$db.dump"
  tables="$(psql -d "$db" -c "SELECT count(*) FROM pg_stat_user_tables")"
  psql -d "$db" -c "ANALYZE" >/dev/null
  rows="$(psql -d "$db" -c "SELECT coalesce(sum(n_live_tup), 0) FROM pg_stat_user_tables")"
  printf '%-14s %7s %9s\n' "$db" "$tables" "$rows"
done
echo
echo "Restore test passed: $(date -u +%Y-%m-%dT%H:%MZ), backup $(basename "$latest")"
