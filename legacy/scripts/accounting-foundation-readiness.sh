#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
WORKSPACE_ID="ws-mu2utgvx-rf4bjhrn"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

section() {
  echo
  echo "[$1] $2"
}

echo "=== ACCOUNTING FOUNDATION READINESS · READ ONLY ==="
echo "WORKSPACE=$WORKSPACE_ID"
echo "Tidak ada INSERT/UPDATE/DELETE di script ini."

section 1 "Identitas perusahaan"
psql_db "SELECT record->>'name' AS perusahaan,
                record->>'ownerUserId' AS owner_user_id,
                COALESCE(record->>'businessType','') AS bentuk_usaha
         FROM app_records
         WHERE table_name='workspace_meta:$WORKSPACE_ID'
         LIMIT 1;"

section 2 "Ringkasan fondasi akuntansi"
psql_db "SELECT x.kind, COUNT(r.id) AS rows
         FROM (VALUES
           ('accounting_accounts'),('accounting_system_mappings'),('accounting_settings'),
           ('accounting_periods'),('opening_balances'),('manual_journals'),
           ('accounts'),('kebun'),('suppliers'),('mills'),('harvesters'),
           ('inventory_groups'),('inventory_units'),('inventory_items'),('inventory_warehouses'),
           ('fixed_asset_groups'),('fixed_assets')
         ) AS x(kind)
         LEFT JOIN app_records r ON r.table_name=x.kind || ':$WORKSPACE_ID'
         GROUP BY x.kind
         ORDER BY x.kind;"

section 3 "COA hierarchy integrity"
psql_db "WITH coa AS (
  SELECT id, record FROM app_records WHERE table_name='accounting_accounts:$WORKSPACE_ID'
)
SELECT
  COUNT(*) AS total_coa,
  COUNT(*) FILTER (WHERE COALESCE(record->>'level','4')='4' AND lower(COALESCE(record->>'posting','true'))='true') AS posting_coa,
  COUNT(*) FILTER (WHERE COALESCE(record->>'level','4')<>'4' AND lower(COALESCE(record->>'posting','false'))='false') AS header_coa,
  COUNT(*) FILTER (WHERE COALESCE(record->>'parentId','')<>'' AND NOT EXISTS (SELECT 1 FROM coa p WHERE p.id=coa.record->>'parentId')) AS orphan_parent,
  COUNT(*) FILTER (WHERE COALESCE(record->>'level','') !~ '^[1-4]$') AS invalid_level
FROM coa;"

psql_db "SELECT record->>'code' AS code,
                COUNT(*) AS posting_duplicates,
                string_agg(id || ' · ' || COALESCE(record->>'name',''), E'\n' ORDER BY id) AS rows
         FROM app_records
         WHERE table_name='accounting_accounts:$WORKSPACE_ID'
           AND COALESCE(record->>'level','4')='4'
           AND lower(COALESCE(record->>'posting','true'))='true'
         GROUP BY record->>'code'
         HAVING COUNT(*)>1
         ORDER BY record->>'code';"

section 4 "Akun Penting integrity"
psql_db "SELECT
  COUNT(*) AS total_mapping,
  COUNT(*) FILTER (WHERE COALESCE(m.record->>'accountId','')<>'') AS mapped,
  COUNT(*) FILTER (WHERE COALESCE(m.record->>'accountId','')<>'' AND coa.id IS NULL) AS orphan_mapping
FROM app_records m
LEFT JOIN app_records coa
  ON coa.table_name='accounting_accounts:$WORKSPACE_ID'
 AND coa.id=m.record->>'accountId'
WHERE m.table_name='accounting_system_mappings:$WORKSPACE_ID';"

psql_db "SELECT m.record->>'key' AS mapping_key,
                coa.record->>'code' AS coa_code,
                coa.record->>'name' AS coa_name,
                coa.record->>'level' AS level,
                coa.record->>'posting' AS posting
         FROM app_records m
         LEFT JOIN app_records coa
           ON coa.table_name='accounting_accounts:$WORKSPACE_ID'
          AND coa.id=m.record->>'accountId'
         WHERE m.table_name='accounting_system_mappings:$WORKSPACE_ID'
         ORDER BY m.record->>'key';"

section 5 "Kas/Bank -> dynamic COA CASH"
psql_db "SELECT op.id AS operational_id,
                op.record->>'name' AS kas_bank,
                op.record->>'type' AS type,
                COUNT(coa.id) AS cash_coa_count,
                string_agg(COALESCE(coa.record->>'code','') || ' · ' || COALESCE(coa.record->>'name',''), ', ' ORDER BY coa.record->>'code') AS cash_coa
         FROM app_records op
         LEFT JOIN app_records coa
           ON coa.table_name='accounting_accounts:$WORKSPACE_ID'
          AND coa.record->>'systemKey'='CASH:' || op.id
         WHERE op.table_name='accounts:$WORKSPACE_ID'
         GROUP BY op.id, op.record->>'name', op.record->>'type'
         ORDER BY op.record->>'type', op.record->>'name';"

psql_db "SELECT coa.id AS coa_id,
                coa.record->>'code' AS code,
                coa.record->>'name' AS name,
                coa.record->>'systemKey' AS system_key
         FROM app_records coa
         WHERE coa.table_name='accounting_accounts:$WORKSPACE_ID'
           AND COALESCE(coa.record->>'systemKey','') LIKE 'CASH:%'
           AND NOT EXISTS (
             SELECT 1 FROM app_records op
             WHERE op.table_name='accounts:$WORKSPACE_ID'
               AND coa.record->>'systemKey'='CASH:' || op.id
           )
         ORDER BY coa.record->>'code';"

section 6 "Inventory master reference integrity"
psql_db "SELECT g.id,
                g.record->>'code' AS code,
                g.record->>'name' AS group_name,
                g.record->>'canStore' AS can_store,
                g.record->>'inventoryAccountId' AS inventory_account_id,
                coa.record->>'code' AS inventory_coa,
                CASE
                  WHEN lower(COALESCE(g.record->>'canStore','false'))='true' AND COALESCE(g.record->>'inventoryAccountId','')='' THEN 'MISSING_ACCOUNT'
                  WHEN COALESCE(g.record->>'inventoryAccountId','')<>'' AND coa.id IS NULL THEN 'ORPHAN_ACCOUNT'
                  ELSE 'OK'
                END AS status
         FROM app_records g
         LEFT JOIN app_records coa
           ON coa.table_name='accounting_accounts:$WORKSPACE_ID'
          AND coa.id=g.record->>'inventoryAccountId'
         WHERE g.table_name='inventory_groups:$WORKSPACE_ID'
         ORDER BY g.record->>'code';"

psql_db "SELECT
  COUNT(*) AS item_rows,
  COUNT(*) FILTER (WHERE grp.id IS NULL) AS orphan_group,
  COUNT(*) FILTER (WHERE unit.id IS NULL) AS orphan_base_unit
FROM app_records i
LEFT JOIN app_records grp
  ON grp.table_name='inventory_groups:$WORKSPACE_ID' AND grp.id=i.record->>'groupId'
LEFT JOIN app_records unit
  ON unit.table_name='inventory_units:$WORKSPACE_ID' AND unit.id=i.record->>'unitId'
WHERE i.table_name='inventory_items:$WORKSPACE_ID';"

section 7 "Fixed asset group account integrity"
psql_db "SELECT g.id,
                g.record->>'code' AS code,
                g.record->>'name' AS group_name,
                g.record->>'depreciable' AS depreciable,
                CASE WHEN COALESCE(g.record->>'assetAccountId','')<>'' AND aa.id IS NOT NULL THEN 'OK' ELSE 'CHECK' END AS asset_account,
                CASE WHEN lower(COALESCE(g.record->>'depreciable','true'))='false' THEN 'N/A' WHEN COALESCE(g.record->>'accumulatedDepreciationAccountId','')<>'' AND ad.id IS NOT NULL THEN 'OK' ELSE 'CHECK' END AS accum_dep_account,
                CASE WHEN lower(COALESCE(g.record->>'depreciable','true'))='false' THEN 'N/A' WHEN COALESCE(g.record->>'depreciationExpenseAccountId','')<>'' AND de.id IS NOT NULL THEN 'OK' ELSE 'CHECK' END AS dep_expense_account,
                CASE WHEN COALESCE(g.record->>'gainAccountId','')<>'' AND ga.id IS NOT NULL THEN 'OK' ELSE 'CHECK' END AS gain_account,
                CASE WHEN COALESCE(g.record->>'lossAccountId','')<>'' AND la.id IS NOT NULL THEN 'OK' ELSE 'CHECK' END AS loss_account
         FROM app_records g
         LEFT JOIN app_records aa ON aa.table_name='accounting_accounts:$WORKSPACE_ID' AND aa.id=g.record->>'assetAccountId'
         LEFT JOIN app_records ad ON ad.table_name='accounting_accounts:$WORKSPACE_ID' AND ad.id=g.record->>'accumulatedDepreciationAccountId'
         LEFT JOIN app_records de ON de.table_name='accounting_accounts:$WORKSPACE_ID' AND de.id=g.record->>'depreciationExpenseAccountId'
         LEFT JOIN app_records ga ON ga.table_name='accounting_accounts:$WORKSPACE_ID' AND ga.id=g.record->>'gainAccountId'
         LEFT JOIN app_records la ON la.table_name='accounting_accounts:$WORKSPACE_ID' AND la.id=g.record->>'lossAccountId'
         WHERE g.table_name='fixed_asset_groups:$WORKSPACE_ID'
         ORDER BY g.record->>'code', g.record->>'name';"

section 8 "Pengaturan tahun buku / cut-off"
psql_db "SELECT id,
                record->>'fiscalYear' AS fiscal_year,
                record->>'fiscalYearStartMonth' AS start_month,
                record->>'conversionDate' AS cutoff,
                record->>'setupComplete' AS setup_complete,
                record->>'openingPosted' AS opening_posted,
                updated_at
         FROM app_records
         WHERE table_name='accounting_settings:$WORKSPACE_ID'
         ORDER BY updated_at DESC;"

section 9 "12 periode akuntansi"
psql_db "SELECT
  COUNT(*) AS total_period,
  COUNT(*) FILTER (WHERE record->>'status'='OPEN') AS open_period,
  COUNT(*) FILTER (WHERE record->>'status'='CLOSED') AS closed_period,
  COUNT(*) FILTER (WHERE record->>'status'='LOCKED') AS locked_period,
  MIN(record->>'startDate') AS first_start,
  MAX(record->>'endDate') AS last_end
FROM app_records
WHERE table_name='accounting_periods:$WORKSPACE_ID';"

psql_db "SELECT record->>'periodKey' AS period_key,
                record->>'label' AS label,
                record->>'startDate' AS start_date,
                record->>'endDate' AS end_date,
                record->>'status' AS status
         FROM app_records
         WHERE table_name='accounting_periods:$WORKSPACE_ID'
         ORDER BY record->>'startDate';"

section 10 "Saldo Awal"
psql_db "SELECT id,
                record->>'cutoffDate' AS cutoff,
                record->>'status' AS status,
                record->>'totalDebit' AS total_debit,
                record->>'totalCredit' AS total_credit,
                CASE WHEN jsonb_typeof(record->'generalLines')='array' THEN jsonb_array_length(record->'generalLines') ELSE 0 END AS general_lines,
                CASE WHEN jsonb_typeof(record->'subledgers')='array' THEN jsonb_array_length(record->'subledgers') ELSE 0 END AS subledgers,
                CASE WHEN jsonb_typeof(record->'fixedAssets')='array' THEN jsonb_array_length(record->'fixedAssets') ELSE 0 END AS fixed_assets,
                record->>'postedAt' AS posted_at
         FROM app_records
         WHERE table_name='opening_balances:$WORKSPACE_ID'
         ORDER BY created_at DESC;"

section 11 "Transaksi detail sebelum foundation siap"
psql_db "SELECT x.kind, COUNT(r.id) AS rows
         FROM (VALUES
           ('transactions'),('purchase_invoices'),('supplier_bills'),('supplier_payments'),
           ('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
           ('tbs'),('tbs_payments'),('tbs_cost_payments'),
           ('payroll_manual'),('payroll_runs'),('employee_receivables'),
           ('manual_journals'),('work_entries')
         ) AS x(kind)
         LEFT JOIN app_records r ON r.table_name=x.kind || ':$WORKSPACE_ID'
         GROUP BY x.kind
         ORDER BY x.kind;"

section 12 "Kesimpulan readiness foundation"
psql_db "WITH
settings AS (
  SELECT COUNT(*) AS cnt,
         COUNT(*) FILTER (WHERE lower(COALESCE(record->>'setupComplete','false'))='true') AS ready
  FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID'
), periods AS (
  SELECT COUNT(*) AS cnt FROM app_records WHERE table_name='accounting_periods:$WORKSPACE_ID'
), opening AS (
  SELECT COUNT(*) AS cnt,
         COUNT(*) FILTER (WHERE record->>'status'='POSTED') AS posted
  FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
), mappings AS (
  SELECT COUNT(*) AS cnt,
         COUNT(*) FILTER (WHERE COALESCE(m.record->>'accountId','')<>'' AND coa.id IS NOT NULL) AS valid
  FROM app_records m
  LEFT JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=m.record->>'accountId'
  WHERE m.table_name='accounting_system_mappings:$WORKSPACE_ID'
), cash_check AS (
  SELECT COUNT(*) AS operational,
         COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM app_records coa WHERE coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.record->>'systemKey'='CASH:' || op.id)=1) AS valid
  FROM app_records op WHERE op.table_name='accounts:$WORKSPACE_ID'
), coa_check AS (
  SELECT COUNT(*) FILTER (WHERE COALESCE(record->>'parentId','')<>'' AND NOT EXISTS (
    SELECT 1 FROM app_records p WHERE p.table_name='accounting_accounts:$WORKSPACE_ID' AND p.id=c.record->>'parentId'
  )) AS orphan_parent
  FROM app_records c WHERE c.table_name='accounting_accounts:$WORKSPACE_ID'
)
SELECT
  CASE
    WHEN (SELECT orphan_parent FROM coa_check)>0 THEN 'RED_COA_ORPHAN_PARENT'
    WHEN (SELECT cnt FROM mappings)=0 OR (SELECT cnt FROM mappings)<>(SELECT valid FROM mappings) THEN 'RED_SYSTEM_MAPPING'
    WHEN (SELECT operational FROM cash_check)<>(SELECT valid FROM cash_check) THEN 'RED_CASH_MAPPING'
    WHEN (SELECT cnt FROM settings)=0 OR (SELECT ready FROM settings)=0 THEN 'BLOCKED_ACCOUNTING_SETTINGS'
    WHEN (SELECT cnt FROM periods)<>12 THEN 'BLOCKED_ACCOUNTING_PERIODS'
    WHEN (SELECT cnt FROM opening)=0 THEN 'BLOCKED_OPENING_BALANCE_NOT_CREATED'
    WHEN (SELECT posted FROM opening)=0 THEN 'BLOCKED_OPENING_BALANCE_DRAFT'
    ELSE 'GREEN_FOUNDATION_READY'
  END AS foundation_status,
  (SELECT cnt FROM settings) AS settings_rows,
  (SELECT cnt FROM periods) AS period_rows,
  (SELECT cnt FROM opening) AS opening_rows,
  (SELECT posted FROM opening) AS opening_posted,
  (SELECT cnt FROM mappings) AS mapping_rows,
  (SELECT valid FROM mappings) AS valid_mapping_rows,
  (SELECT operational FROM cash_check) AS kas_bank_rows,
  (SELECT valid FROM cash_check) AS valid_cash_mapping;
"

echo
echo "=== END ACCOUNTING FOUNDATION READINESS ==="
