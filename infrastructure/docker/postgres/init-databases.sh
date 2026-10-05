#!/bin/sh
# Runs once, when the Postgres volume is created: one database and one role per
# service (database-per-service, ADR-002). A role can only connect to its own
# database. Passwords are local-development values, not secrets.
set -eu

for db in auth products inventory cart orders payments notifications reviews admin; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE "$db" LOGIN PASSWORD '${db}-dev-password';
CREATE DATABASE "$db" OWNER "$db";
REVOKE ALL ON DATABASE "$db" FROM PUBLIC;
SQL
done
