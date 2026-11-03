#!/usr/bin/env bash
# Daily logical backup of every service database to Cloud Storage (docs/deploy-google-cloud.md).
# Run by the cse-backup.timer that setup-vm.sh installs; by hand: sudo deploy/gcp-vm/backup-db.sh
#
# Writes gs://$BACKUP_BUCKET/<UTC timestamp>/{globals.sql,<database>.dump,SHA256SUMS}. The VM's
# service account may only create objects in that bucket: it cannot read, overwrite or delete a
# backup, so a compromised VM cannot destroy them. The bucket's lifecycle rule removes them after
# 35 days. Restore check: deploy/gcp-vm/restore-test.sh (from Cloud Shell).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="$here/.env"
bucket="$(grep '^BACKUP_BUCKET=' "$env_file" | cut -d= -f2)"
[ -n "$bucket" ] || { echo "BACKUP_BUCKET is not set in $env_file" >&2; exit 1; }
databases=(auth products inventory cart orders payments notifications reviews admin)
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"

# Roles and their attributes, without password hashes (the passwords live in .env).
"$here/dc" exec -T postgres pg_dumpall -U postgres --globals-only --no-role-passwords >globals.sql
for db in "${databases[@]}"; do
  "$here/dc" exec -T postgres pg_dump -U postgres --format=custom "$db" >"$db.dump"
  # A custom-format dump starts with PGDMP; anything else is an error message, not a backup.
  [ "$(head -c 5 "$db.dump")" = PGDMP ] || { echo "pg_dump $db failed" >&2; exit 1; }
done
sha256sum globals.sql ./*.dump >SHA256SUMS

# Upload with the VM's own credentials from the metadata server (no keys on disk).
token="$(curl -fsS -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' |
  sed -E 's/.*"access_token":"([^"]+)".*/\1/')"
for file in globals.sql ./*.dump SHA256SUMS; do
  name="${file#./}"
  curl -fsS -o /dev/null -X POST \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/octet-stream' \
    --data-binary "@$name" \
    "https://storage.googleapis.com/upload/storage/v1/b/$bucket/o?uploadType=media&name=$stamp/$name"
done

echo "backup $stamp: ${#databases[@]} databases, $(du -ch ./*.dump | tail -1 | cut -f1) → gs://$bucket/$stamp/"
