#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

section() {
  echo
  echo "[$1] $2"
}

echo "=== ADMINISTRASI PERKEBUNAN · WORKSPACE ORIGIN AUDIT ==="
echo "MODE=READ_ONLY"
echo "Waktu: $(date '+%F %T %Z')"

RUNTIME_USER_ID="$(docker compose exec -T app node -e 'const c=require("node:crypto"); const configured=(process.env.ADMIN_USER_ID||"").trim(); const email=(process.env.ADMIN_EMAIL||"").trim().toLowerCase(); process.stdout.write(configured || c.createHash("sha256").update(email).digest("hex").slice(0,32));' 2>/dev/null || true)"
echo "RUNTIME_USER_ID=${RUNTIME_USER_ID:-UNAVAILABLE}"

section 1 "Identitas semua workspace dari workspace_meta"
psql_db "SELECT
  substring(table_name from position(':' in table_name)+1) AS workspace_id,
  record->>'name' AS perusahaan,
  record->>'ownerUserId' AS owner_user_id,
  record->>'businessType' AS bentuk_usaha,
  record->>'createdAt' AS created_at
FROM app_records
WHERE table_name LIKE 'workspace_meta:%'
ORDER BY COALESCE(record->>'createdAt',''), workspace_id;"

section 2 "Semua membership: user -> workspace"
psql_db "SELECT
  substring(table_name from position(':' in table_name)+1) AS user_id,
  record->>'workspaceId' AS workspace_id,
  record->>'workspaceName' AS perusahaan,
  record->>'role' AS role,
  record->>'joinedAt' AS joined_at
FROM app_records
WHERE table_name LIKE 'workspace_memberships:%'
ORDER BY user_id, joined_at, workspace_id;"

section 3 "Workspace aktif per user"
psql_db "SELECT
  substring(table_name from position(':' in table_name)+1) AS user_id,
  record->>'activeWorkspaceId' AS active_workspace_id,
  record->>'updatedAt' AS updated_at
FROM app_records
WHERE table_name LIKE 'workspace_profile:%'
ORDER BY user_id, updated_at;"

section 4 "Member internal per workspace (tanpa email)"
psql_db "SELECT
  substring(table_name from position(':' in table_name)+1) AS workspace_id,
  record->>'userId' AS user_id,
  record->>'name' AS nama,
  record->>'role' AS role,
  record->>'joinedAt' AS joined_at
FROM app_records
WHERE table_name LIKE 'workspace_members:%'
ORDER BY workspace_id, joined_at, user_id;"

section 5 "Jumlah record bisnis per workspace"
psql_db "WITH logical AS (
  SELECT
    split_part(table_name, ':', 1) AS kind,
    substring(table_name from position(':' in table_name)+1) AS workspace_id,
    COUNT(*) AS rows
  FROM app_records
  WHERE position(':' in table_name) > 0
    AND split_part(table_name, ':', 1) IN (
      'kebun','accounts','transactions','suppliers','supplier_bills','supplier_payments',
      'mills','harvesters','vehicles','rates','tbs','tbs_payments','tbs_cost_payments',
      'work_types','work_rates','work_entries','employee_receivables','payroll_manual','payroll_runs',
      'accounting_accounts','accounting_system_mappings','accounting_settings','accounting_periods','opening_balances','manual_journals',
      'inventory_groups','inventory_units','inventory_items','inventory_warehouses','inventory_warehouse_balances','inventory_usages','inventory_transfers','inventory_stocktakes',
      'fixed_asset_groups','fixed_assets'
    )
  GROUP BY 1,2
)
SELECT workspace_id, kind, rows
FROM logical
ORDER BY workspace_id, kind;"

section 6 "Ringkasan akuntansi per workspace"
psql_db "WITH workspaces AS (
  SELECT DISTINCT substring(table_name from position(':' in table_name)+1) AS workspace_id
  FROM app_records
  WHERE table_name LIKE 'workspace_meta:%'
     OR table_name LIKE 'accounting_accounts:%'
), agg AS (
  SELECT
    w.workspace_id,
    (SELECT COUNT(*) FROM app_records r WHERE r.table_name='accounting_accounts:' || w.workspace_id) AS coa,
    (SELECT COUNT(*) FROM app_records r WHERE r.table_name='accounting_system_mappings:' || w.workspace_id) AS mappings,
    (SELECT COUNT(*) FROM app_records r WHERE r.table_name='accounting_settings:' || w.workspace_id) AS settings,
    (SELECT COUNT(*) FROM app_records r WHERE r.table_name='accounting_periods:' || w.workspace_id) AS periods,
    (SELECT COUNT(*) FROM app_records r WHERE r.table_name='opening_balances:' || w.workspace_id) AS opening_batches,
    (SELECT COUNT(*) FROM app_records r WHERE r.table_name='manual_journals:' || w.workspace_id) AS manual_journals
  FROM workspaces w
)
SELECT a.workspace_id,
       COALESCE(m.record->>'name','') AS perusahaan,
       a.coa, a.mappings, a.settings, a.periods, a.opening_batches, a.manual_journals
FROM agg a
LEFT JOIN app_records m
  ON m.table_name='workspace_meta:' || a.workspace_id
ORDER BY a.workspace_id;"

section 7 "Sampel master operasional per workspace"
psql_db "WITH samples AS (
  SELECT substring(table_name from position(':' in table_name)+1) AS workspace_id,
         split_part(table_name, ':', 1) AS kind,
         CASE split_part(table_name, ':', 1)
           WHEN 'kebun' THEN COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name','')
           WHEN 'accounts' THEN COALESCE(record->>'name','') || ' · ' || COALESCE(record->>'type','')
           WHEN 'suppliers' THEN COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name','')
           WHEN 'mills' THEN COALESCE(record->>'name','')
           WHEN 'harvesters' THEN COALESCE(record->>'name','')
           WHEN 'vehicles' THEN COALESCE(record->>'plateNumber','') || ' · ' || COALESCE(record->>'name','')
           WHEN 'rates' THEN COALESCE(record->>'kebunId','') || ' · ' || COALESCE(record->>'effectiveDate','')
           WHEN 'inventory_groups' THEN COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name','')
           WHEN 'inventory_units' THEN COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name','')
           WHEN 'inventory_items' THEN COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name','')
           WHEN 'inventory_warehouses' THEN COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name','')
           ELSE ''
         END AS sample,
         ROW_NUMBER() OVER (
           PARTITION BY substring(table_name from position(':' in table_name)+1), split_part(table_name, ':', 1)
           ORDER BY created_at, id
         ) AS rn
  FROM app_records
  WHERE position(':' in table_name) > 0
    AND split_part(table_name, ':', 1) IN ('kebun','accounts','suppliers','mills','harvesters','vehicles','rates','inventory_groups','inventory_units','inventory_items','inventory_warehouses')
)
SELECT workspace_id, kind, sample
FROM samples
WHERE rn <= 5
ORDER BY workspace_id, kind, rn;"

section 8 "Kecocokan owner/membership terhadap runtime user"
if [ -n "$RUNTIME_USER_ID" ]; then
  psql_db "WITH meta AS (
    SELECT substring(table_name from position(':' in table_name)+1) AS workspace_id,
           record->>'name' AS perusahaan,
           record->>'ownerUserId' AS owner_user_id
    FROM app_records
    WHERE table_name LIKE 'workspace_meta:%'
  ), membership AS (
    SELECT record->>'workspaceId' AS workspace_id,
           record->>'role' AS role
    FROM app_records
    WHERE table_name='workspace_memberships:$RUNTIME_USER_ID'
  )
  SELECT m.workspace_id,
         m.perusahaan,
         m.owner_user_id,
         CASE WHEN m.owner_user_id='$RUNTIME_USER_ID' THEN 'YES' ELSE 'NO' END AS runtime_is_owner,
         COALESCE(ms.role,'NO_MEMBERSHIP') AS runtime_membership
  FROM meta m
  LEFT JOIN membership ms ON ms.workspace_id=m.workspace_id
  ORDER BY m.workspace_id;"
fi

section 9 "Kemungkinan workspace legacy"
psql_db "WITH meta AS (
  SELECT substring(table_name from position(':' in table_name)+1) AS workspace_id,
         record->>'name' AS perusahaan,
         record->>'ownerUserId' AS owner_user_id,
         record->>'createdAt' AS created_at
  FROM app_records
  WHERE table_name LIKE 'workspace_meta:%'
), business_counts AS (
  SELECT substring(table_name from position(':' in table_name)+1) AS workspace_id,
         COUNT(*) AS business_rows
  FROM app_records
  WHERE position(':' in table_name) > 0
    AND split_part(table_name, ':', 1) IN (
      'kebun','accounts','transactions','suppliers','mills','harvesters','vehicles','rates','tbs',
      'accounting_accounts','accounting_system_mappings','accounting_settings','accounting_periods','opening_balances',
      'inventory_groups','inventory_units','inventory_items','inventory_warehouses','inventory_warehouse_balances',
      'fixed_asset_groups','fixed_assets'
    )
  GROUP BY 1
), membership_counts AS (
  SELECT record->>'workspaceId' AS workspace_id, COUNT(*) AS memberships
  FROM app_records
  WHERE table_name LIKE 'workspace_memberships:%'
  GROUP BY 1
)
SELECT m.workspace_id, m.perusahaan, m.owner_user_id,
       COALESCE(b.business_rows,0) AS business_rows,
       COALESCE(mc.memberships,0) AS memberships,
       CASE
         WHEN m.workspace_id=m.owner_user_id THEN 'LEGACY_ID_PATTERN'
         WHEN COALESCE(mc.memberships,0)=0 THEN 'ORPHAN_NO_MEMBERSHIP'
         ELSE 'NORMAL_MULTI_COMPANY'
       END AS indicator
FROM meta m
LEFT JOIN business_counts b ON b.workspace_id=m.workspace_id
LEFT JOIN membership_counts mc ON mc.workspace_id=m.workspace_id
ORDER BY business_rows DESC, m.workspace_id;"

echo
echo "=== END WORKSPACE ORIGIN AUDIT ==="
echo "Tidak ada data yang diubah oleh script ini."
