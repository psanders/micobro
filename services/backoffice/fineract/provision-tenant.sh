#!/usr/bin/env bash
#
# Copyright (C) 2026 by Pedro Sanders. MIT License.
#
# Onboards a lending business as its own Fineract tenant, with its own
# database, on the local stack from compose.yaml:
#
#   1. create the tenant's database;
#   2. register it in Fineract's tenant registry (fineract_tenants), reusing
#      the default tenant's encrypted database credentials (same Postgres);
#   3. restart Fineract: on startup it migrates every registered tenant's
#      database and sets up its per-tenant state (rounding mode, caches);
#   4. wait until Fineract answers for the new tenant.
#
# Fineract has no API to create tenants, and a tenant added while it runs is
# not usable until a restart (verified: its tables can be created by another
# instance, but the running one fails with "Rounding mode is not initialized
# for tenant"). Locally that is ~30 s of downtime; in production, run two or
# more Fineract instances and restart them one at a time. The BFF sets up the
# rest (products, mora charges, payment types, grace) on first use.
#
# Usage: provision-tenant.sh <identifier> "<business name>"
#   identifier: lowercase letters, digits and hyphens (Fineract-Platform-TenantId)
set -euo pipefail

ID="${1:-}"
NAME="${2:-}"
if [[ ! "$ID" =~ ^[a-z0-9-]{2,40}$ || -z "$NAME" ]]; then
  echo "usage: $0 <identifier> \"<business name>\"  (identifier: a-z, 0-9, -)" >&2
  exit 2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
COMPOSE=(docker compose -f "$HERE/compose.yaml")
DB_NAME="fineract_t_${ID//-/_}"
NAME_SQL="${NAME//\'/\'\'}"
psql() { "${COMPOSE[@]}" exec -T db psql -U fineract -v ON_ERROR_STOP=1 -q "$@"; }

if [[ -n "$(psql -d fineract_tenants -tAc "SELECT 1 FROM tenants WHERE identifier = '$ID'")" ]]; then
  echo "tenant '$ID' already exists" >&2
  exit 1
fi

echo "→ creating database $DB_NAME"
psql -d postgres -c "CREATE DATABASE $DB_NAME"

echo "→ registering tenant '$ID'"
psql -d fineract_tenants <<SQL
BEGIN;
INSERT INTO tenant_server_connections (schema_server, schema_name, schema_server_port, schema_username,
  schema_password, auto_update, schema_connection_parameters, master_password_hash)
SELECT schema_server, '$DB_NAME', schema_server_port, schema_username, schema_password, auto_update,
  schema_connection_parameters, master_password_hash
FROM tenant_server_connections WHERE id = (SELECT oltp_id FROM tenants WHERE identifier = 'default');
INSERT INTO tenants (identifier, name, timezone_id, oltp_id, report_id)
SELECT '$ID', '$NAME_SQL', 'America/Santo_Domingo', max(id), max(id) FROM tenant_server_connections;
COMMIT;
SQL

echo "→ restarting Fineract so it migrates and loads the new tenant"
"${COMPOSE[@]}" restart fineract >/dev/null

echo "→ waiting for Fineract to serve '$ID'"
for _ in $(seq 1 60); do
  # Connections drop while Fineract restarts; that's "not yet", not a failure.
  code=$(curl -s -o /dev/null -w "%{http_code}" -u mifos:password \
    -H "Fineract-Platform-TenantId: $ID" http://localhost:8088/fineract-provider/api/v1/offices || true)
  if [[ "$code" == "200" ]]; then
    echo "✓ tenant '$ID' ($NAME) is ready on database $DB_NAME"
    exit 0
  fi
  sleep 3
done
echo "tenant '$ID' did not come up (last HTTP $code)" >&2
exit 1
