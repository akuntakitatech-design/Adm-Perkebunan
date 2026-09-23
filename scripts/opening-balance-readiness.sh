#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
WORKSPACE_ID="ws-mu2utgvx-rf4bjhrn"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

echo "=== OPENING BALANCE READINESS · READ ONLY ==="
echo "WORKSPACE=$WORKSPACE_ID"
echo "Tidak ada INSERT/UPDATE/DELETE di script ini."

echo
echo "[1] Settings, periode, dan status Saldo Awal"
psql_db "SELECT
  (SELECT COUNT(*) FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID') AS settings_rows,
  (SELECT COUNT(*) FROM app_records WHERE table_name='accounting_periods:$WORKSPACE_ID') AS period_rows,
  (SELECT COUNT(*) FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID') AS opening_rows,
  COALESCE((SELECT record->>'conversionDate' FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID' ORDER BY updated_at DESC LIMIT 1),'') AS cutoff,
  COALESCE((SELECT record->>'openingPosted' FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID' ORDER BY updated_at DESC LIMIT 1),'false') AS opening_posted;"

echo
echo "[2] Akun neraca Level 4: MANUAL vs CONTROLLED"
psql_db "WITH controlled AS (
  SELECT id FROM app_records
  WHERE table_name='accounting_accounts:$WORKSPACE_ID'
    AND (COALESCE(record->>'systemKey','') LIKE 'CASH:%' OR COALESCE(record->>'systemKey','') IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER'))
  UNION
  SELECT record->>'accountId' FROM app_records
  WHERE table_name='accounting_system_mappings:$WORKSPACE_ID'
    AND record->>'key' IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER')
  UNION
  SELECT record->>'inventoryAccountId' FROM app_records
  WHERE table_name='inventory_groups:$WORKSPACE_ID' AND lower(COALESCE(record->>'canStore','false'))='true'
  UNION
  SELECT record->>'assetAccountId' FROM app_records
  WHERE table_name='fixed_asset_groups:$WORKSPACE_ID'
  UNION
  SELECT record->>'accumulatedDepreciationAccountId' FROM app_records
  WHERE table_name='fixed_asset_groups:$WORKSPACE_ID' AND COALESCE(record->>'accumulatedDepreciationAccountId','')<>''
), coa AS (
  SELECT id, record FROM app_records
  WHERE table_name='accounting_accounts:$WORKSPACE_ID'
    AND COALESCE(record->>'level','4')='4'
    AND lower(COALESCE(record->>'posting','true'))='true'
    AND lower(COALESCE(record->>'active','true'))='true'
    AND substring(COALESCE(record->>'code','') from 1 for 1) IN ('1','2','3')
)
SELECT CASE WHEN c.id IS NULL THEN 'MANUAL' ELSE 'CONTROLLED' END AS input_mode,
       COUNT(*) AS account_count
FROM coa a LEFT JOIN controlled c ON c.id=a.id
GROUP BY 1 ORDER BY 1;"

psql_db "WITH controlled AS (
  SELECT id FROM app_records
  WHERE table_name='accounting_accounts:$WORKSPACE_ID'
    AND (COALESCE(record->>'systemKey','') LIKE 'CASH:%' OR COALESCE(record->>'systemKey','') IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER'))
  UNION SELECT record->>'accountId' FROM app_records WHERE table_name='accounting_system_mappings:$WORKSPACE_ID' AND record->>'key' IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER')
  UNION SELECT record->>'inventoryAccountId' FROM app_records WHERE table_name='inventory_groups:$WORKSPACE_ID' AND lower(COALESCE(record->>'canStore','false'))='true'
  UNION SELECT record->>'assetAccountId' FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID'
  UNION SELECT record->>'accumulatedDepreciationAccountId' FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID' AND COALESCE(record->>'accumulatedDepreciationAccountId','')<>''
)
SELECT a.record->>'code' AS code,
       a.record->>'name' AS name,
       CASE WHEN c.id IS NULL THEN 'MANUAL' ELSE 'CONTROLLED' END AS input_mode,
       COALESCE(a.record->>'systemKey','') AS system_key
FROM app_records a
LEFT JOIN controlled c ON c.id=a.id
WHERE a.table_name='accounting_accounts:$WORKSPACE_ID'
  AND COALESCE(a.record->>'level','4')='4'
  AND lower(COALESCE(a.record->>'posting','true'))='true'
  AND lower(COALESCE(a.record->>'active','true'))='true'
  AND substring(COALESCE(a.record->>'code','') from 1 for 1) IN ('1','2','3')
ORDER BY a.record->>'code', a.record->>'name';"

echo
echo "[3] Subledger mapping readiness"
psql_db "WITH map AS (
  SELECT record->>'key' AS k, record->>'accountId' AS account_id
  FROM app_records WHERE table_name='accounting_system_mappings:$WORKSPACE_ID'
), cash AS (
  SELECT COUNT(*) AS entities,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM app_records c
           WHERE c.table_name='accounting_accounts:$WORKSPACE_ID'
             AND c.record->>'systemKey'='CASH:' || a.id
         )) AS valid_mapping
  FROM app_records a WHERE a.table_name='accounts:$WORKSPACE_ID'
)
SELECT 'CASH_BANK' AS kind, cash.entities, cash.valid_mapping, CASE WHEN cash.entities=cash.valid_mapping AND cash.entities>0 THEN 'OK' ELSE 'CHECK' END AS status FROM cash
UNION ALL
SELECT 'PKS',
       (SELECT COUNT(*) FROM app_records WHERE table_name='mills:$WORKSPACE_ID'),
       CASE WHEN EXISTS (SELECT 1 FROM map m JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.account_id WHERE m.k='AR_PKS') THEN 1 ELSE 0 END,
       CASE WHEN EXISTS (SELECT 1 FROM map m JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.account_id WHERE m.k='AR_PKS') THEN 'OK' ELSE 'CHECK' END
UNION ALL
SELECT 'EMPLOYEE',
       (SELECT COUNT(*) FROM app_records WHERE table_name='harvesters:$WORKSPACE_ID'),
       CASE WHEN EXISTS (SELECT 1 FROM map m JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.account_id WHERE m.k='AR_EMPLOYEE') THEN 1 ELSE 0 END,
       CASE WHEN EXISTS (SELECT 1 FROM map m JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.account_id WHERE m.k='AR_EMPLOYEE') THEN 'OK' ELSE 'CHECK' END
UNION ALL
SELECT 'SUPPLIER',
       (SELECT COUNT(*) FROM app_records WHERE table_name='suppliers:$WORKSPACE_ID'),
       CASE WHEN EXISTS (SELECT 1 FROM map m JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.account_id WHERE m.k='AP_SUPPLIER') THEN 1 ELSE 0 END,
       CASE WHEN EXISTS (SELECT 1 FROM map m JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.account_id WHERE m.k='AP_SUPPLIER') THEN 'OK' ELSE 'CHECK' END;"

echo
echo "[4] Inventory untuk Saldo Awal"
psql_db "SELECT i.id,
       i.record->>'code' AS item_code,
       i.record->>'name' AS item_name,
       g.record->>'name' AS group_name,
       u.record->>'code' AS base_unit,
       g.record->>'inventoryAccountId' AS inventory_account_id,
       coa.record->>'code' AS inventory_coa,
       CASE WHEN g.id IS NOT NULL AND u.id IS NOT NULL AND coa.id IS NOT NULL AND lower(COALESCE(g.record->>'canStore','false'))='true' THEN 'OK' ELSE 'CHECK' END AS status
FROM app_records i
LEFT JOIN app_records g ON g.table_name='inventory_groups:$WORKSPACE_ID' AND g.id=i.record->>'groupId'
LEFT JOIN app_records u ON u.table_name='inventory_units:$WORKSPACE_ID' AND u.id=i.record->>'unitId'
LEFT JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=g.record->>'inventoryAccountId'
WHERE i.table_name='inventory_items:$WORKSPACE_ID'
ORDER BY i.record->>'code';"

psql_db "SELECT id,
       record->>'code' AS code,
       record->>'name' AS name,
       record->>'isDefault' AS is_default,
       record->>'active' AS active,
       record->>'kebunId' AS kebun_id
FROM app_records
WHERE table_name='inventory_warehouses:$WORKSPACE_ID'
ORDER BY created_at;"

echo
echo "[5] Aset Tetap untuk Saldo Awal"
psql_db "SELECT COUNT(*) AS fixed_asset_rows,
       COUNT(*) FILTER (WHERE COALESCE(record->>'status','ACTIVE')='ACTIVE') AS active_assets,
       COUNT(*) FILTER (WHERE COALESCE(record->>'acquisitionDate','')<='2025-12-31') AS assets_on_or_before_cutoff
FROM app_records WHERE table_name='fixed_assets:$WORKSPACE_ID';"

psql_db "SELECT record->>'code' AS code,
       record->>'name' AS name,
       record->>'depreciable' AS depreciable,
       CASE WHEN COALESCE(record->>'assetAccountId','')<>'' THEN 'OK' ELSE 'MISSING' END AS asset_account,
       CASE WHEN lower(COALESCE(record->>'depreciable','false'))='true' AND COALESCE(record->>'accumulatedDepreciationAccountId','')='' THEN 'MISSING' ELSE 'OK' END AS accum_dep_account
FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID'
ORDER BY record->>'code';"

echo
echo "[6] Existing operational opening fields sebelum draft"
psql_db "SELECT record->>'name' AS kas_bank,
       record->>'type' AS type,
       COALESCE(record->>'openingBalance','0') AS opening_balance
FROM app_records WHERE table_name='accounts:$WORKSPACE_ID'
ORDER BY record->>'type',record->>'name';"

psql_db "SELECT record->>'code' AS item_code,
       record->>'name' AS item_name,
       COALESCE(record->>'openingQuantity','0') AS opening_qty,
       COALESCE(record->>'openingAverageCost','0') AS opening_avg_cost,
       COALESCE(record->>'currentQuantity','0') AS current_qty,
       COALESCE(record->>'stockValue','0') AS stock_value
FROM app_records WHERE table_name='inventory_items:$WORKSPACE_ID'
ORDER BY record->>'code';"

echo
echo "[7] Transaksi setelah cut-off yang akan memengaruhi rekalkulasi opening inventory"
psql_db "WITH cutoff AS (
  SELECT COALESCE(record->>'conversionDate','') AS d
  FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID'
  ORDER BY updated_at DESC LIMIT 1
)
SELECT x.kind, COUNT(r.id) AS rows_after_cutoff
FROM (VALUES ('purchase_invoices'),('inventory_usages')) AS x(kind)
CROSS JOIN cutoff c
LEFT JOIN app_records r ON r.table_name=x.kind || ':$WORKSPACE_ID' AND COALESCE(r.record->>'date','')>c.d
GROUP BY x.kind ORDER BY x.kind;"

echo
echo "[8] Entitas subledger tersedia"
psql_db "SELECT 'CASH_BANK' AS kind, COUNT(*) AS rows FROM app_records WHERE table_name='accounts:$WORKSPACE_ID'
UNION ALL SELECT 'PKS', COUNT(*) FROM app_records WHERE table_name='mills:$WORKSPACE_ID'
UNION ALL SELECT 'EMPLOYEE', COUNT(*) FROM app_records WHERE table_name='harvesters:$WORKSPACE_ID'
UNION ALL SELECT 'SUPPLIER', COUNT(*) FROM app_records WHERE table_name='suppliers:$WORKSPACE_ID'
UNION ALL SELECT 'INVENTORY', COUNT(*) FROM app_records WHERE table_name='inventory_items:$WORKSPACE_ID';"

echo
echo "[9] Proteksi cut-off dan periode"
psql_db "SELECT record->>'fiscalYear' AS fiscal_year,
       record->>'fiscalYearStartMonth' AS start_month,
       record->>'conversionDate' AS cutoff,
       record->>'setupComplete' AS setup_complete,
       record->>'openingPosted' AS opening_posted
FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID'
ORDER BY updated_at DESC LIMIT 1;"

psql_db "SELECT COUNT(*) FILTER (WHERE record->>'status'='OPEN') AS open_periods,
       COUNT(*) FILTER (WHERE record->>'status'='CLOSED') AS closed_periods,
       COUNT(*) FILTER (WHERE record->>'status'='LOCKED') AS locked_periods
FROM app_records WHERE table_name='accounting_periods:$WORKSPACE_ID';"

echo
echo "[10] Kesimpulan readiness Saldo Awal"
psql_db "WITH
settings AS (
  SELECT COUNT(*) AS n,
         COUNT(*) FILTER (WHERE lower(COALESCE(record->>'setupComplete','false'))='true' AND COALESCE(record->>'conversionDate','')<>'') AS valid
  FROM app_records WHERE table_name='accounting_settings:$WORKSPACE_ID'
), periods AS (
  SELECT COUNT(*) AS n FROM app_records WHERE table_name='accounting_periods:$WORKSPACE_ID'
), maps AS (
  SELECT COUNT(*) AS n,
         COUNT(*) FILTER (WHERE COALESCE(record->>'accountId','')<>'' AND EXISTS (
           SELECT 1 FROM app_records c WHERE c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=m.record->>'accountId'
         )) AS valid
  FROM app_records m WHERE m.table_name='accounting_system_mappings:$WORKSPACE_ID'
), cash AS (
  SELECT COUNT(*) AS n,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM app_records c WHERE c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.record->>'systemKey'='CASH:' || a.id
         )) AS valid
  FROM app_records a WHERE a.table_name='accounts:$WORKSPACE_ID'
), inv AS (
  SELECT COUNT(*) AS items,
         COUNT(*) FILTER (WHERE g.id IS NULL OR u.id IS NULL OR coa.id IS NULL OR lower(COALESCE(g.record->>'canStore','false'))<>'true') AS invalid
  FROM app_records i
  LEFT JOIN app_records g ON g.table_name='inventory_groups:$WORKSPACE_ID' AND g.id=i.record->>'groupId'
  LEFT JOIN app_records u ON u.table_name='inventory_units:$WORKSPACE_ID' AND u.id=i.record->>'unitId'
  LEFT JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=g.record->>'inventoryAccountId'
  WHERE i.table_name='inventory_items:$WORKSPACE_ID'
), wh AS (
  SELECT COUNT(*) FILTER (WHERE lower(COALESCE(record->>'active','true'))='true') AS active,
         COUNT(*) FILTER (WHERE lower(COALESCE(record->>'isDefault','false'))='true') AS defaults
  FROM app_records WHERE table_name='inventory_warehouses:$WORKSPACE_ID'
), fa AS (
  SELECT COUNT(*) FILTER (
    WHERE COALESCE(record->>'assetAccountId','')=''
       OR (lower(COALESCE(record->>'depreciable','false'))='true' AND COALESCE(record->>'accumulatedDepreciationAccountId','')='')
  ) AS invalid_groups
  FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID'
), opening AS (
  SELECT COUNT(*) AS n,
         COUNT(*) FILTER (WHERE record->>'status'='POSTED') AS posted,
         COUNT(*) FILTER (WHERE record->>'status'='DRAFT') AS draft
  FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
)
SELECT CASE
  WHEN opening.posted>0 THEN 'OPENING_ALREADY_POSTED'
  WHEN opening.draft>0 THEN 'OPENING_DRAFT_EXISTS_REVIEW_BEFORE_POST'
  WHEN settings.n<>1 OR settings.valid<>1 THEN 'BLOCKED_SETTINGS'
  WHEN periods.n<>12 THEN 'BLOCKED_PERIODS'
  WHEN maps.n<>25 OR maps.valid<>25 THEN 'BLOCKED_SYSTEM_MAPPING'
  WHEN cash.n=0 OR cash.n<>cash.valid THEN 'BLOCKED_CASH_MAPPING'
  WHEN inv.invalid>0 THEN 'BLOCKED_INVENTORY_REFERENCE'
  WHEN wh.active=0 OR wh.defaults<>1 THEN 'BLOCKED_DEFAULT_WAREHOUSE'
  WHEN fa.invalid_groups>0 THEN 'BLOCKED_FIXED_ASSET_MAPPING'
  ELSE 'READY_FOR_OPENING_DRAFT'
END AS opening_readiness,
settings.n AS settings_rows,
periods.n AS period_rows,
maps.n AS mapping_rows,
maps.valid AS valid_mapping_rows,
cash.n AS cash_rows,
cash.valid AS valid_cash_rows,
inv.items AS inventory_items,
inv.invalid AS invalid_inventory_items,
wh.active AS active_warehouses,
wh.defaults AS default_warehouses,
fa.invalid_groups AS invalid_fixed_asset_groups,
opening.n AS opening_rows
FROM settings,periods,maps,cash,inv,wh,fa,opening;"

echo
echo "=== END OPENING BALANCE READINESS ==="
