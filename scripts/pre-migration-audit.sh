#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
SOURCE_WORKSPACE_ID="f6233ad0442e68812cf057e9fea7e76d"
TARGET_WORKSPACE_ID="ws-mu2utgvx-rf4bjhrn"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

section() {
  echo
  echo "[$1] $2"
}

echo "=== FINAL PRE-MIGRATION AUDIT · READ ONLY ==="
echo "SOURCE=$SOURCE_WORKSPACE_ID"
echo "TARGET=$TARGET_WORKSPACE_ID"
echo "Tidak ada INSERT/UPDATE/DELETE di script ini."

section 1 "Identitas source dan target"
psql_db "SELECT split_part(table_name, ':', 2) AS workspace_id,
                record->>'name' AS perusahaan,
                record->>'ownerUserId' AS owner_user_id,
                created_at
         FROM app_records
         WHERE table_name IN ('workspace_meta:$SOURCE_WORKSPACE_ID','workspace_meta:$TARGET_WORKSPACE_ID')
         ORDER BY created_at;"

section 2 "Duplicate COA code per workspace"
psql_db "WITH coa AS (
    SELECT '$SOURCE_WORKSPACE_ID' AS workspace_id, id, record FROM app_records WHERE table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
    UNION ALL
    SELECT '$TARGET_WORKSPACE_ID' AS workspace_id, id, record FROM app_records WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
  )
  SELECT workspace_id,
         record->>'code' AS code,
         COUNT(*) AS duplicate_count,
         string_agg(id || ' · ' || COALESCE(record->>'name',''), E'\n' ORDER BY id) AS rows
  FROM coa
  GROUP BY workspace_id, record->>'code'
  HAVING COUNT(*) > 1
  ORDER BY workspace_id, record->>'code';"

section 3 "Detail COA kritikal 2101 / 2102"
psql_db "WITH coa AS (
    SELECT '$SOURCE_WORKSPACE_ID' AS workspace_id, id, record FROM app_records WHERE table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
    UNION ALL
    SELECT '$TARGET_WORKSPACE_ID' AS workspace_id, id, record FROM app_records WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
  )
  SELECT workspace_id,
         id,
         record->>'code' AS code,
         record->>'name' AS name,
         record->>'systemKey' AS system_key,
         record->>'level' AS level,
         record->>'parentId' AS parent_id,
         record->>'posting' AS posting,
         record->>'active' AS active
  FROM coa
  WHERE record->>'code' IN ('2101','2102')
  ORDER BY workspace_id, record->>'code', id;"

section 4 "Akun Penting AP_SUPPLIER dan PAYROLL_PAYABLE mengarah ke COA mana"
psql_db "WITH mappings AS (
    SELECT '$SOURCE_WORKSPACE_ID' AS workspace_id, record FROM app_records WHERE table_name='accounting_system_mappings:$SOURCE_WORKSPACE_ID'
    UNION ALL
    SELECT '$TARGET_WORKSPACE_ID' AS workspace_id, record FROM app_records WHERE table_name='accounting_system_mappings:$TARGET_WORKSPACE_ID'
  ), coa AS (
    SELECT '$SOURCE_WORKSPACE_ID' AS workspace_id, id, record FROM app_records WHERE table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
    UNION ALL
    SELECT '$TARGET_WORKSPACE_ID' AS workspace_id, id, record FROM app_records WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
  )
  SELECT m.workspace_id,
         m.record->>'key' AS mapping_key,
         m.record->>'accountId' AS account_id,
         c.record->>'code' AS coa_code,
         c.record->>'name' AS coa_name,
         c.record->>'systemKey' AS coa_system_key
  FROM mappings m
  LEFT JOIN coa c
    ON c.workspace_id=m.workspace_id
   AND c.id=m.record->>'accountId'
  WHERE m.record->>'key' IN ('AP_SUPPLIER','PAYROLL_PAYABLE')
  ORDER BY m.workspace_id, mapping_key;"

section 5 "Kas/Bank source dan pasangan COA CASH:<operationalAccountId>"
psql_db "SELECT op.id AS operational_account_id,
                op.record->>'name' AS operational_name,
                op.record->>'type' AS type,
                op.record->>'openingBalance' AS opening_balance,
                coa.id AS coa_id,
                coa.record->>'code' AS coa_code,
                coa.record->>'name' AS coa_name,
                coa.record->>'systemKey' AS coa_system_key
         FROM app_records op
         LEFT JOIN app_records coa
           ON coa.table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
          AND coa.record->>'systemKey'='CASH:' || op.id
         WHERE op.table_name='accounts:$SOURCE_WORKSPACE_ID'
         ORDER BY op.record->>'type', op.record->>'name';"

section 6 "Semua COA CASH:* di target sebelum migrasi"
psql_db "SELECT id AS coa_id,
                record->>'code' AS code,
                record->>'name' AS name,
                record->>'systemKey' AS system_key,
                record->>'parentId' AS parent_id
         FROM app_records
         WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
           AND COALESCE(record->>'systemKey','') LIKE 'CASH:%'
         ORDER BY record->>'code', id;"

section 7 "COA kas/bank source-only yang mungkin perlu direcreate, bukan dicopy ID"
psql_db "SELECT s.id AS source_coa_id,
                s.record->>'code' AS code,
                s.record->>'name' AS source_name,
                s.record->>'systemKey' AS source_system_key,
                t.id AS target_same_code_id,
                t.record->>'name' AS target_same_code_name,
                t.record->>'systemKey' AS target_same_code_system_key
         FROM app_records s
         LEFT JOIN app_records t
           ON t.table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
          AND t.record->>'code'=s.record->>'code'
         WHERE s.table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
           AND (
             COALESCE(s.record->>'systemKey','') LIKE 'CASH:%'
             OR s.record->>'code' IN ('1101.001','1102.001')
           )
         ORDER BY s.record->>'code', s.id;"

section 8 "ID master yang akan diremap"
psql_db "SELECT 'kebun' AS kind, id, record->>'code' AS natural_key, record->>'name' AS name, '' AS dependency_id
         FROM app_records WHERE table_name='kebun:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'supplier', id, record->>'code', record->>'name', ''
         FROM app_records WHERE table_name='suppliers:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'harvester', id, lower(record->>'name'), record->>'name', ''
         FROM app_records WHERE table_name='harvesters:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'mill', id, lower(record->>'name'), record->>'name', ''
         FROM app_records WHERE table_name='mills:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'account', id, lower(record->>'name') || '|' || (record->>'type'), record->>'name', ''
         FROM app_records WHERE table_name='accounts:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'vehicle', id, record->>'plateNumber', COALESCE(record->>'name',''), COALESCE(record->>'supplierId','')
         FROM app_records WHERE table_name='vehicles:$SOURCE_WORKSPACE_ID'
         UNION ALL
         SELECT 'rate', id, record->>'effectiveDate', COALESCE(record->>'effectiveDate',''), COALESCE(record->>'kebunId','')
         FROM app_records WHERE table_name='rates:$SOURCE_WORKSPACE_ID'
         ORDER BY kind, natural_key;"

section 9 "Collision check natural key di target"
psql_db "WITH src AS (
    SELECT 'kebun' kind, id, lower(COALESCE(record->>'code','')) natural_key FROM app_records WHERE table_name='kebun:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'supplier', id, lower(COALESCE(record->>'code','')) FROM app_records WHERE table_name='suppliers:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'harvester', id, lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='harvesters:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'mill', id, lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='mills:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'account', id, lower(COALESCE(record->>'name','')) || '|' || COALESCE(record->>'type','') FROM app_records WHERE table_name='accounts:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'vehicle', id, lower(COALESCE(record->>'plateNumber','')) FROM app_records WHERE table_name='vehicles:$SOURCE_WORKSPACE_ID'
  ), tgt AS (
    SELECT 'kebun' kind, id, lower(COALESCE(record->>'code','')) natural_key FROM app_records WHERE table_name='kebun:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'supplier', id, lower(COALESCE(record->>'code','')) FROM app_records WHERE table_name='suppliers:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'harvester', id, lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='harvesters:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'mill', id, lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='mills:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'account', id, lower(COALESCE(record->>'name','')) || '|' || COALESCE(record->>'type','') FROM app_records WHERE table_name='accounts:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'vehicle', id, lower(COALESCE(record->>'plateNumber','')) FROM app_records WHERE table_name='vehicles:$TARGET_WORKSPACE_ID'
  )
  SELECT s.kind,
         s.id AS source_id,
         s.natural_key,
         t.id AS target_id,
         CASE WHEN t.id IS NULL THEN 'NO_COLLISION' ELSE 'ALREADY_EXISTS' END AS status
  FROM src s
  LEFT JOIN tgt t ON t.kind=s.kind AND t.natural_key=s.natural_key
  ORDER BY s.kind, s.natural_key;"

section 10 "Transaksi target harus tetap kosong sebelum migrasi master"
psql_db "SELECT x.kind,
                COUNT(r.id) AS target_rows
         FROM (VALUES
           ('transactions'),('purchase_invoices'),('supplier_bills'),('supplier_payments'),
           ('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
           ('tbs'),('tbs_payments'),('tbs_cost_payments'),
           ('payroll_manual'),('payroll_runs'),('employee_receivables'),
           ('fixed_assets'),('manual_journals'),('opening_balances'),('work_entries')
         ) AS x(kind)
         LEFT JOIN app_records r ON r.table_name=x.kind || ':$TARGET_WORKSPACE_ID'
         GROUP BY x.kind
         ORDER BY x.kind;"

section 11 "Ringkasan jumlah kandidat migrasi"
psql_db "SELECT x.kind,
                COUNT(s.id) AS source_rows,
                COUNT(t.id) AS existing_target_rows
         FROM (VALUES
           ('accounts'),('harvesters'),('kebun'),('mills'),('suppliers'),('vehicles'),('rates')
         ) AS x(kind)
         LEFT JOIN app_records s ON s.table_name=x.kind || ':$SOURCE_WORKSPACE_ID'
         LEFT JOIN app_records t ON t.table_name=x.kind || ':$TARGET_WORKSPACE_ID'
         GROUP BY x.kind
         ORDER BY x.kind;"

echo
echo "=== END FINAL PRE-MIGRATION AUDIT ==="
echo "Jika duplicate COA kritikal / CASH mapping bermasalah, jangan jalankan migrasi sampai diperbaiki."
