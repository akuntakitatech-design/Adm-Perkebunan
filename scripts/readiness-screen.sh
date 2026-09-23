#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
cd "$APP_DIR"

section() {
  echo
  echo "[$1] $2"
}

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

psql_value() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq' <<< "$1" | tr -d '\r' | head -n 1
}

echo "=== ADMINISTRASI PERKEBUNAN · READINESS SCREEN v2 ==="
echo "Waktu: $(date '+%F %T %Z')"

section 1 "Git / source"
printf "HEAD: "
git log -1 --oneline
printf "Working tree: "
if [ -z "$(git status --porcelain --untracked-files=no)" ]; then
  echo "CLEAN"
else
  echo "DIRTY"
  git status --short --untracked-files=no
fi

section 2 "Docker services"
docker compose ps

section 3 "App local health"
if curl -fsS --max-time 5 http://127.0.0.1:8088/ >/dev/null 2>&1; then
  echo "APP_HTTP=OK"
else
  echo "APP_HTTP=FAIL"
fi

section 4 "Runtime user identity (tanpa email/password)"
RUNTIME_USER_ID="$(docker compose exec -T app node -e 'const c=require("node:crypto"); const configured=(process.env.ADMIN_USER_ID||"").trim(); const email=(process.env.ADMIN_EMAIL||"").trim().toLowerCase(); process.stdout.write(configured || c.createHash("sha256").update(email).digest("hex").slice(0,32));' 2>/dev/null || true)"
if [ -n "$RUNTIME_USER_ID" ]; then
  echo "RUNTIME_USER_ID=$RUNTIME_USER_ID"
else
  echo "RUNTIME_USER_ID=UNAVAILABLE"
fi

section 5 "Membership perusahaan untuk runtime user"
if [ -n "$RUNTIME_USER_ID" ]; then
  psql_db "SELECT record->>'workspaceId' AS workspace_id,
                  record->>'workspaceName' AS perusahaan,
                  record->>'role' AS role,
                  created_at
           FROM app_records
           WHERE table_name='workspace_memberships:$RUNTIME_USER_ID'
           ORDER BY created_at;"
fi

section 6 "Perusahaan aktif"
ACTIVE_WORKSPACE_ID=""
if [ -n "$RUNTIME_USER_ID" ]; then
  ACTIVE_WORKSPACE_ID="$(psql_value "WITH memberships AS (
      SELECT record->>'workspaceId' AS workspace_id, created_at
      FROM app_records
      WHERE table_name='workspace_memberships:$RUNTIME_USER_ID'
    ), profile AS (
      SELECT record->>'activeWorkspaceId' AS workspace_id
      FROM app_records
      WHERE table_name='workspace_profile:$RUNTIME_USER_ID'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    )
    SELECT COALESCE(
      (SELECT p.workspace_id FROM profile p WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=p.workspace_id)),
      (SELECT m.workspace_id FROM memberships m ORDER BY m.created_at LIMIT 1),
      ''
    );")"
fi

if [ -n "$ACTIVE_WORKSPACE_ID" ]; then
  echo "ACTIVE_WORKSPACE_ID=$ACTIVE_WORKSPACE_ID"
  psql_db "SELECT record->>'name' AS perusahaan,
                  record->>'ownerUserId' AS owner_user_id,
                  record->>'businessType' AS bentuk_usaha
           FROM app_records
           WHERE table_name='workspace_meta:$ACTIVE_WORKSPACE_ID'
           ORDER BY created_at
           LIMIT 1;"
else
  echo "ACTIVE_WORKSPACE_ID=UNAVAILABLE"
fi

section 7 "Database records by logical table"
psql_db "SELECT table_name, COUNT(*) AS rows
         FROM app_records
         GROUP BY table_name
         ORDER BY table_name;"

section 8 "Core table counts untuk perusahaan aktif"
if [ -n "$ACTIVE_WORKSPACE_ID" ]; then
  psql_db "SELECT x.kind, COUNT(r.id) AS rows
           FROM (VALUES
             ('kebun'),('accounts'),('transactions'),
             ('accounting_accounts'),('accounting_system_mappings'),
             ('accounting_settings'),('accounting_periods'),('opening_balances'),
             ('suppliers'),('supplier_bills'),('supplier_payments'),('purchase_invoices'),
             ('inventory_groups'),('inventory_units'),('inventory_items'),('inventory_warehouses'),
             ('inventory_warehouse_balances'),('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
             ('fixed_asset_groups'),('fixed_assets'),
             ('mills'),('harvesters'),('vehicles'),('rates'),('tbs'),('tbs_payments'),('tbs_cost_payments'),
             ('work_types'),('work_rates'),('work_entries'),('employee_receivables'),('payroll_manual'),('payroll_runs'),
             ('manual_journals')
           ) AS x(kind)
           LEFT JOIN app_records r ON r.table_name=x.kind || ':$ACTIVE_WORKSPACE_ID'
           GROUP BY x.kind
           ORDER BY x.kind;"
fi

section 9 "COA integrity"
if [ -n "$ACTIVE_WORKSPACE_ID" ]; then
  psql_db "SELECT
      COUNT(*) AS total_coa,
      COUNT(*) FILTER (WHERE lower(COALESCE(record->>'active','true'))='true') AS active_coa,
      COUNT(*) FILTER (
        WHERE COALESCE(CASE WHEN COALESCE(record->>'level','') ~ '^[1-4]$' THEN (record->>'level')::int END,4)=4
          AND lower(COALESCE(record->>'posting','true'))='true'
      ) AS posting_coa,
      COUNT(*) FILTER (WHERE COALESCE(record->>'systemKey','') <> '') AS system_coa
    FROM app_records
    WHERE table_name='accounting_accounts:$ACTIVE_WORKSPACE_ID';"

  psql_db "SELECT record->>'code' AS code,
                  record->>'name' AS name,
                  record->>'level' AS level,
                  record->>'posting' AS posting,
                  record->>'systemKey' AS system_key
           FROM app_records
           WHERE table_name='accounting_accounts:$ACTIVE_WORKSPACE_ID'
           ORDER BY record->>'code'
           LIMIT 30;"
fi

section 10 "Akun Penting / system mapping integrity"
if [ -n "$ACTIVE_WORKSPACE_ID" ]; then
  psql_db "SELECT
      COUNT(*) AS total_mapping,
      COUNT(*) FILTER (WHERE COALESCE(record->>'accountId','') <> '') AS mapped,
      COUNT(*) FILTER (
        WHERE COALESCE(record->>'accountId','') <> ''
          AND NOT EXISTS (
            SELECT 1 FROM app_records coa
            WHERE coa.table_name='accounting_accounts:$ACTIVE_WORKSPACE_ID'
              AND coa.id=(m.record->>'accountId')
          )
      ) AS orphan_mapping
    FROM app_records m
    WHERE m.table_name='accounting_system_mappings:$ACTIVE_WORKSPACE_ID';"

  psql_db "SELECT m.record->>'key' AS mapping_key,
                  m.record->>'accountId' AS account_id,
                  COALESCE(coa.record->>'code','') AS coa_code,
                  COALESCE(coa.record->>'name','') AS coa_name
           FROM app_records m
           LEFT JOIN app_records coa
             ON coa.table_name='accounting_accounts:$ACTIVE_WORKSPACE_ID'
            AND coa.id=(m.record->>'accountId')
           WHERE m.table_name='accounting_system_mappings:$ACTIVE_WORKSPACE_ID'
           ORDER BY m.record->>'key';"
fi

section 11 "Periode akuntansi"
if [ -n "$ACTIVE_WORKSPACE_ID" ]; then
  psql_db "SELECT
      COUNT(*) AS total_period,
      COUNT(*) FILTER (WHERE record->>'status'='OPEN') AS open_period,
      COUNT(*) FILTER (WHERE record->>'status'='CLOSED') AS closed_period,
      COUNT(*) FILTER (WHERE record->>'status'='LOCKED') AS locked_period,
      MIN(record->>'startDate') AS first_start,
      MAX(record->>'endDate') AS last_end
    FROM app_records
    WHERE table_name='accounting_periods:$ACTIVE_WORKSPACE_ID';"

  psql_db "SELECT record->>'periodKey' AS periode,
                  record->>'status' AS status,
                  record->>'startDate' AS mulai,
                  record->>'endDate' AS selesai
           FROM app_records
           WHERE table_name='accounting_periods:$ACTIVE_WORKSPACE_ID'
           ORDER BY record->>'startDate';"
fi

section 12 "Saldo awal"
if [ -n "$ACTIVE_WORKSPACE_ID" ]; then
  psql_db "SELECT
      COUNT(*) AS total_batch,
      COUNT(*) FILTER (WHERE record->>'status'='DRAFT') AS draft,
      COUNT(*) FILTER (WHERE record->>'status'='POSTED') AS posted,
      MAX(record->>'cutoffDate') AS latest_cutoff
    FROM app_records
    WHERE table_name='opening_balances:$ACTIVE_WORKSPACE_ID';"

  psql_db "SELECT record->>'cutoffDate' AS cutoff,
                  record->>'status' AS status,
                  record->>'totalDebit' AS total_debit,
                  record->>'totalCredit' AS total_credit,
                  jsonb_array_length(COALESCE(record->'generalLines','[]'::jsonb)) AS general_lines,
                  jsonb_array_length(COALESCE(record->'subledgers','[]'::jsonb)) AS subledger_lines
           FROM app_records
           WHERE table_name='opening_balances:$ACTIVE_WORKSPACE_ID'
           ORDER BY created_at DESC
           LIMIT 5;"
fi

section 13 "Ringkasan semua workspace bisnis"
psql_db "WITH logical AS (
    SELECT split_part(table_name, ':', 1) AS kind,
           substring(table_name from position(':' in table_name)+1) AS workspace_id,
           COUNT(*) AS rows
    FROM app_records
    WHERE position(':' in table_name) > 0
      AND split_part(table_name, ':', 1) IN (
        'kebun','accounts','transactions','accounting_accounts','accounting_system_mappings',
        'accounting_settings','accounting_periods','opening_balances','suppliers','purchase_invoices',
        'inventory_items','fixed_assets','tbs','payroll_runs','manual_journals'
      )
    GROUP BY 1,2
  )
  SELECT workspace_id,
         COUNT(*) AS logical_tables,
         SUM(rows) AS records
  FROM logical
  GROUP BY workspace_id
  ORDER BY records DESC, workspace_id;"

section 14 "Backup / auto-deploy markers"
if [ -f data/source-migration.failed ]; then
  echo "SOURCE_MIGRATION_MARKER=FAIL_PRESENT"
else
  echo "SOURCE_MIGRATION_MARKER=OK"
fi

if [ -d backups ]; then
  printf "Latest backup: "
  find backups -maxdepth 1 -type f -printf '%T@ %f\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2- || true
else
  echo "Backup directory: tidak ditemukan di ./backups"
fi

echo
echo "=== END SCREEN ==="
