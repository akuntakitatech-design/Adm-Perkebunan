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

echo "=== ADMINISTRASI PERKEBUNAN · WORKSPACE DEPENDENCY AUDIT ==="
echo "READ ONLY · tidak memindahkan / mengubah / menghapus data"
echo "Waktu: $(date '+%F %T %Z')"

RUNTIME_USER_ID="$(docker compose exec -T app node -e 'const c=require("node:crypto"); const configured=(process.env.ADMIN_USER_ID||"").trim(); const email=(process.env.ADMIN_EMAIL||"").trim().toLowerCase(); process.stdout.write(configured || c.createHash("sha256").update(email).digest("hex").slice(0,32));' 2>/dev/null || true)"

TARGET_WORKSPACE_ID="$(psql_value "WITH memberships AS (
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

SOURCE_WORKSPACE_ID="$(psql_value "WITH candidates AS (
  SELECT substring(m.table_name from position(':' in m.table_name)+1) AS workspace_id,
         COALESCE(m.record->>'name','') AS workspace_name,
         COALESCE(m.record->>'ownerUserId','') AS owner_user_id,
         (SELECT COUNT(*) FROM app_records r
          WHERE position(':' in r.table_name)>0
            AND substring(r.table_name from position(':' in r.table_name)+1)=substring(m.table_name from position(':' in m.table_name)+1)
            AND split_part(r.table_name,':',1) IN ('kebun','accounts','suppliers','harvesters','mills','vehicles','rates','tbs','transactions','purchase_invoices','supplier_bills','inventory_items')) AS business_rows
  FROM app_records m
  WHERE m.table_name LIKE 'workspace_meta:%'
)
SELECT workspace_id
FROM candidates
WHERE workspace_id <> '$TARGET_WORKSPACE_ID'
  AND owner_user_id <> '$RUNTIME_USER_ID'
ORDER BY (workspace_name='Administrasi Perkebunan') DESC, business_rows DESC
LIMIT 1;")"

section 1 "Sumber dan target audit"
echo "RUNTIME_USER_ID=$RUNTIME_USER_ID"
echo "SOURCE_WORKSPACE_ID=$SOURCE_WORKSPACE_ID"
echo "TARGET_WORKSPACE_ID=$TARGET_WORKSPACE_ID"
psql_db "SELECT substring(table_name from position(':' in table_name)+1) AS workspace_id,
                record->>'name' AS perusahaan,
                record->>'ownerUserId' AS owner_user_id,
                created_at
         FROM app_records
         WHERE table_name IN ('workspace_meta:$SOURCE_WORKSPACE_ID','workspace_meta:$TARGET_WORKSPACE_ID')
         ORDER BY workspace_id;"

if [ -z "$SOURCE_WORKSPACE_ID" ] || [ -z "$TARGET_WORKSPACE_ID" ]; then
  echo "SOURCE/TARGET workspace tidak dapat ditentukan. Audit dihentikan tanpa perubahan data."
  exit 1
fi

section 2 "Jumlah record sumber vs target"
psql_db "WITH kinds(kind) AS (VALUES
  ('kebun'),('accounts'),('suppliers'),('harvesters'),('mills'),('vehicles'),('rates'),
  ('inventory_groups'),('inventory_units'),('inventory_items'),('inventory_warehouses'),
  ('accounting_accounts'),('accounting_system_mappings'),('fixed_asset_groups'),
  ('transactions'),('supplier_bills'),('supplier_payments'),('purchase_invoices'),
  ('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
  ('tbs'),('tbs_payments'),('tbs_cost_payments'),('work_entries'),('employee_receivables'),('payroll_runs'),('manual_journals')
)
SELECT k.kind,
       COUNT(s.id) AS source_rows,
       COUNT(t.id) AS target_rows
FROM kinds k
LEFT JOIN app_records s ON s.table_name=k.kind || ':$SOURCE_WORKSPACE_ID'
LEFT JOIN LATERAL (
  SELECT id FROM app_records x WHERE x.table_name=k.kind || ':$TARGET_WORKSPACE_ID'
) t ON false
GROUP BY k.kind
ORDER BY k.kind;"

# Count target separately to avoid cross multiplication and make output reliable.
psql_db "WITH kinds(kind) AS (VALUES
  ('kebun'),('accounts'),('suppliers'),('harvesters'),('mills'),('vehicles'),('rates'),
  ('inventory_groups'),('inventory_units'),('inventory_items'),('inventory_warehouses'),
  ('accounting_accounts'),('accounting_system_mappings'),('fixed_asset_groups'),
  ('transactions'),('supplier_bills'),('supplier_payments'),('purchase_invoices'),
  ('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
  ('tbs'),('tbs_payments'),('tbs_cost_payments'),('work_entries'),('employee_receivables'),('payroll_runs'),('manual_journals')
)
SELECT k.kind,
       (SELECT COUNT(*) FROM app_records s WHERE s.table_name=k.kind || ':$SOURCE_WORKSPACE_ID') AS source_rows,
       (SELECT COUNT(*) FROM app_records t WHERE t.table_name=k.kind || ':$TARGET_WORKSPACE_ID') AS target_rows
FROM kinds k
ORDER BY k.kind;"

section 3 "Perbandingan natural key master operasional"
psql_db "WITH compare AS (
  SELECT 'kebun' kind, s.id source_id, COALESCE(s.record->>'code','') natural_key,
         COALESCE(s.record->>'name','') source_name,
         t.id target_id, COALESCE(t.record->>'name','') target_name
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='kebun:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'code',''))=lower(COALESCE(s.record->>'code',''))
  WHERE s.table_name='kebun:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'accounts', s.id, lower(COALESCE(s.record->>'name','')) || '|' || COALESCE(s.record->>'type',''),
         COALESCE(s.record->>'name',''), t.id, COALESCE(t.record->>'name','')
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='accounts:$TARGET_WORKSPACE_ID'
    AND lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name',''))
    AND COALESCE(t.record->>'type','')=COALESCE(s.record->>'type','')
  WHERE s.table_name='accounts:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'suppliers', s.id, COALESCE(NULLIF(s.record->>'code',''),lower(s.record->>'name')),
         COALESCE(s.record->>'name',''), t.id, COALESCE(t.record->>'name','')
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='suppliers:$TARGET_WORKSPACE_ID'
    AND (lower(COALESCE(t.record->>'code',''))=lower(COALESCE(s.record->>'code','')) OR lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name','')))
  WHERE s.table_name='suppliers:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'harvesters', s.id, lower(COALESCE(s.record->>'name','')), COALESCE(s.record->>'name',''), t.id, COALESCE(t.record->>'name','')
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='harvesters:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name',''))
  WHERE s.table_name='harvesters:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'mills', s.id, lower(COALESCE(s.record->>'name','')), COALESCE(s.record->>'name',''), t.id, COALESCE(t.record->>'name','')
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='mills:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name',''))
  WHERE s.table_name='mills:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'vehicles', s.id, upper(COALESCE(s.record->>'plateNumber','')), COALESCE(s.record->>'name',''), t.id, COALESCE(t.record->>'name','')
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='vehicles:$TARGET_WORKSPACE_ID' AND upper(COALESCE(t.record->>'plateNumber',''))=upper(COALESCE(s.record->>'plateNumber',''))
  WHERE s.table_name='vehicles:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'inventory_warehouses', s.id, lower(COALESCE(s.record->>'code','')), COALESCE(s.record->>'name',''), t.id, COALESCE(t.record->>'name','')
  FROM app_records s
  LEFT JOIN app_records t ON t.table_name='inventory_warehouses:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'code',''))=lower(COALESCE(s.record->>'code',''))
  WHERE s.table_name='inventory_warehouses:$SOURCE_WORKSPACE_ID'
)
SELECT kind, natural_key, source_name, COALESCE(target_name,'') AS target_name,
       CASE WHEN target_id IS NULL THEN 'MIGRATE_CANDIDATE' ELSE 'ALREADY_EXISTS' END AS status
FROM compare
ORDER BY kind, natural_key;"

section 4 "Dependency master di workspace sumber"
psql_db "SELECT 'vehicle->supplier' AS dependency,
                v.id AS source_row_id,
                COALESCE(v.record->>'plateNumber',v.record->>'name','') AS source_row,
                COALESCE(v.record->>'supplierId','') AS referenced_id,
                CASE
                  WHEN COALESCE(v.record->>'supplierId','')='' THEN 'NOT_REQUIRED'
                  WHEN s.id IS NOT NULL THEN 'SOURCE_OK'
                  ELSE 'BROKEN_SOURCE_REF'
                END AS source_status,
                COALESCE(s.record->>'code',s.record->>'name','') AS referenced_master
         FROM app_records v
         LEFT JOIN app_records s ON s.table_name='suppliers:$SOURCE_WORKSPACE_ID' AND s.id=v.record->>'supplierId'
         WHERE v.table_name='vehicles:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'rate->kebun', r.id, COALESCE(r.record->>'effectiveDate',''), COALESCE(r.record->>'kebunId',''),
                CASE WHEN k.id IS NOT NULL THEN 'SOURCE_OK' ELSE 'BROKEN_SOURCE_REF' END,
                COALESCE(k.record->>'code',k.record->>'name','')
         FROM app_records r
         LEFT JOIN app_records k ON k.table_name='kebun:$SOURCE_WORKSPACE_ID' AND k.id=r.record->>'kebunId'
         WHERE r.table_name='rates:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'warehouse->kebun', w.id, COALESCE(w.record->>'code',w.record->>'name',''), COALESCE(w.record->>'kebunId',''),
                CASE
                  WHEN COALESCE(w.record->>'kebunId','')='' THEN 'NOT_REQUIRED'
                  WHEN k.id IS NOT NULL THEN 'SOURCE_OK'
                  ELSE 'BROKEN_SOURCE_REF'
                END,
                COALESCE(k.record->>'code',k.record->>'name','')
         FROM app_records w
         LEFT JOIN app_records k ON k.table_name='kebun:$SOURCE_WORKSPACE_ID' AND k.id=w.record->>'kebunId'
         WHERE w.table_name='inventory_warehouses:$SOURCE_WORKSPACE_ID'
         ORDER BY 1,2;"

section 5 "Top-level ID references antar-record di workspace sumber"
psql_db "WITH src AS (
  SELECT split_part(table_name,':',1) AS kind, id, record
  FROM app_records
  WHERE table_name LIKE '%:$SOURCE_WORKSPACE_ID'
), refs AS (
  SELECT a.kind AS from_kind, a.id AS from_id, kv.key AS field_name, kv.value AS referenced_id,
         b.kind AS to_kind, b.id AS to_id
  FROM src a
  CROSS JOIN LATERAL jsonb_each_text(a.record) kv
  JOIN src b ON b.id=kv.value
  WHERE a.id<>b.id
)
SELECT from_kind, field_name, to_kind, COUNT(*) AS references
FROM refs
GROUP BY from_kind, field_name, to_kind
ORDER BY from_kind, field_name, to_kind;"

section 6 "COA source vs target — jangan copy buta"
psql_db "WITH s AS (
  SELECT record->>'code' code, record->>'name' name, id
  FROM app_records WHERE table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
), t AS (
  SELECT record->>'code' code, record->>'name' name, id
  FROM app_records WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
)
SELECT
  (SELECT COUNT(*) FROM s) AS source_coa,
  (SELECT COUNT(*) FROM t) AS target_coa,
  (SELECT COUNT(*) FROM s JOIN t USING(code)) AS same_code,
  (SELECT COUNT(*) FROM s LEFT JOIN t USING(code) WHERE t.id IS NULL) AS only_source,
  (SELECT COUNT(*) FROM t LEFT JOIN s USING(code) WHERE s.id IS NULL) AS only_target,
  (SELECT COUNT(*) FROM s JOIN t USING(code) WHERE lower(COALESCE(s.name,''))<>lower(COALESCE(t.name,''))) AS same_code_name_diff;"

psql_db "WITH s AS (
  SELECT record->>'code' code, record->>'name' name FROM app_records WHERE table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
), t AS (
  SELECT record->>'code' code, record->>'name' name FROM app_records WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
)
SELECT COALESCE(s.code,t.code) AS code,
       COALESCE(s.name,'') AS source_name,
       COALESCE(t.name,'') AS target_name,
       CASE WHEN s.code IS NULL THEN 'ONLY_TARGET'
            WHEN t.code IS NULL THEN 'ONLY_SOURCE'
            ELSE 'NAME_DIFFERENT' END AS status
FROM s FULL JOIN t USING(code)
WHERE s.code IS NULL OR t.code IS NULL OR lower(COALESCE(s.name,''))<>lower(COALESCE(t.name,''))
ORDER BY COALESCE(s.code,t.code)
LIMIT 50;"

section 7 "Akun Penting source vs target berdasarkan key + kode COA"
psql_db "WITH sm AS (
  SELECT m.record->>'key' mapping_key, a.record->>'code' coa_code, a.record->>'name' coa_name
  FROM app_records m
  LEFT JOIN app_records a ON a.table_name='accounting_accounts:$SOURCE_WORKSPACE_ID' AND a.id=m.record->>'accountId'
  WHERE m.table_name='accounting_system_mappings:$SOURCE_WORKSPACE_ID'
), tm AS (
  SELECT m.record->>'key' mapping_key, a.record->>'code' coa_code, a.record->>'name' coa_name
  FROM app_records m
  LEFT JOIN app_records a ON a.table_name='accounting_accounts:$TARGET_WORKSPACE_ID' AND a.id=m.record->>'accountId'
  WHERE m.table_name='accounting_system_mappings:$TARGET_WORKSPACE_ID'
)
SELECT COALESCE(sm.mapping_key,tm.mapping_key) mapping_key,
       COALESCE(sm.coa_code,'') source_code,
       COALESCE(tm.coa_code,'') target_code,
       CASE
         WHEN sm.mapping_key IS NULL THEN 'ONLY_TARGET'
         WHEN tm.mapping_key IS NULL THEN 'ONLY_SOURCE'
         WHEN COALESCE(sm.coa_code,'')=COALESCE(tm.coa_code,'') THEN 'SAME'
         ELSE 'DIFFERENT'
       END status
FROM sm FULL JOIN tm USING(mapping_key)
ORDER BY mapping_key;"

section 8 "Transaksi/subledger yang membuat migrasi lebih berisiko"
psql_db "WITH kinds(kind) AS (VALUES
  ('transactions'),('supplier_bills'),('supplier_payments'),('purchase_invoices'),
  ('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
  ('tbs'),('tbs_payments'),('tbs_cost_payments'),('work_entries'),('employee_receivables'),
  ('payroll_manual'),('payroll_runs'),('fixed_assets'),('manual_journals'),('opening_balances')
)
SELECT kind,
       (SELECT COUNT(*) FROM app_records r WHERE r.table_name=kind || ':$SOURCE_WORKSPACE_ID') AS source_rows,
       CASE WHEN (SELECT COUNT(*) FROM app_records r WHERE r.table_name=kind || ':$SOURCE_WORKSPACE_ID')=0
            THEN 'LOW_RISK_EMPTY' ELSE 'REVIEW_REQUIRED' END AS migration_risk
FROM kinds
ORDER BY kind;"

section 9 "Ringkasan kandidat master untuk migrasi"
psql_db "WITH candidates AS (
  SELECT 'kebun' kind, COUNT(*) source_rows,
         COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records t WHERE t.table_name='kebun:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'code',''))=lower(COALESCE(s.record->>'code','')))) new_rows
  FROM app_records s WHERE s.table_name='kebun:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'accounts', COUNT(*), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records t WHERE t.table_name='accounts:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name','')) AND COALESCE(t.record->>'type','')=COALESCE(s.record->>'type','')))
  FROM app_records s WHERE s.table_name='accounts:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'suppliers', COUNT(*), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records t WHERE t.table_name='suppliers:$TARGET_WORKSPACE_ID' AND (lower(COALESCE(t.record->>'code',''))=lower(COALESCE(s.record->>'code','')) OR lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name','')))))
  FROM app_records s WHERE s.table_name='suppliers:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'harvesters', COUNT(*), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records t WHERE t.table_name='harvesters:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name',''))))
  FROM app_records s WHERE s.table_name='harvesters:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'mills', COUNT(*), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records t WHERE t.table_name='mills:$TARGET_WORKSPACE_ID' AND lower(COALESCE(t.record->>'name',''))=lower(COALESCE(s.record->>'name',''))))
  FROM app_records s WHERE s.table_name='mills:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'vehicles', COUNT(*), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records t WHERE t.table_name='vehicles:$TARGET_WORKSPACE_ID' AND upper(COALESCE(t.record->>'plateNumber',''))=upper(COALESCE(s.record->>'plateNumber',''))))
  FROM app_records s WHERE s.table_name='vehicles:$SOURCE_WORKSPACE_ID'
  UNION ALL
  SELECT 'rates', COUNT(*), COUNT(*) FROM app_records s WHERE s.table_name='rates:$SOURCE_WORKSPACE_ID'
)
SELECT kind, source_rows, new_rows,
       CASE WHEN new_rows=0 THEN 'NO_ACTION'
            WHEN kind='rates' THEN 'MIGRATE_AFTER_KEBUN_ID_MAPPING'
            WHEN kind='vehicles' THEN 'MIGRATE_AFTER_SUPPLIER_ID_MAPPING'
            ELSE 'MIGRATE_CANDIDATE' END recommendation
FROM candidates
ORDER BY kind;"

echo
echo "=== END WORKSPACE DEPENDENCY AUDIT ==="
echo "Tidak ada data yang diubah oleh script ini."
