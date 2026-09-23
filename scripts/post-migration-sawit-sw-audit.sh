#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
SOURCE_WORKSPACE_ID="f6233ad0442e68812cf057e9fea7e76d"
TARGET_WORKSPACE_ID="ws-mu2utgvx-rf4bjhrn"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

echo "=== POST MIGRATION AUDIT · PERKEBUNAN SAWIT SW ==="
echo "SOURCE=$SOURCE_WORKSPACE_ID"
echo "TARGET=$TARGET_WORKSPACE_ID"

echo
echo "[1] Jumlah master source vs target"
psql_db "WITH kinds(kind) AS (VALUES ('kebun'),('accounts'),('suppliers'),('harvesters'),('mills'),('vehicles'),('rates'))
SELECT k.kind,
       (SELECT COUNT(*) FROM app_records s WHERE s.table_name=k.kind || ':$SOURCE_WORKSPACE_ID') AS source_rows,
       (SELECT COUNT(*) FROM app_records t WHERE t.table_name=k.kind || ':$TARGET_WORKSPACE_ID') AS target_rows
FROM kinds k ORDER BY k.kind;"

echo
echo "[2] Data master target"
psql_db "SELECT 'kebun' AS kind, id, COALESCE(record->>'code','') AS code, COALESCE(record->>'name','') AS name FROM app_records WHERE table_name='kebun:$TARGET_WORKSPACE_ID'
UNION ALL SELECT 'account', id, COALESCE(record->>'type',''), COALESCE(record->>'name','') FROM app_records WHERE table_name='accounts:$TARGET_WORKSPACE_ID'
UNION ALL SELECT 'supplier', id, COALESCE(record->>'code',''), COALESCE(record->>'name','') FROM app_records WHERE table_name='suppliers:$TARGET_WORKSPACE_ID'
UNION ALL SELECT 'harvester', id, '', COALESCE(record->>'name','') FROM app_records WHERE table_name='harvesters:$TARGET_WORKSPACE_ID'
UNION ALL SELECT 'mill', id, '', COALESCE(record->>'name','') FROM app_records WHERE table_name='mills:$TARGET_WORKSPACE_ID'
UNION ALL SELECT 'vehicle', id, COALESCE(record->>'plateNumber',''), COALESCE(record->>'name','') FROM app_records WHERE table_name='vehicles:$TARGET_WORKSPACE_ID'
ORDER BY kind, code, name;"

echo
echo "[3] Kas/Bank -> COA CASH mapping"
psql_db "SELECT op.id AS operational_id,
                op.record->>'name' AS kas_bank,
                op.record->>'type' AS type,
                coa.id AS coa_id,
                coa.record->>'code' AS coa_code,
                coa.record->>'name' AS coa_name,
                coa.record->>'level' AS level,
                coa.record->>'posting' AS posting,
                coa.record->>'systemKey' AS system_key,
                parent.record->>'code' AS parent_code,
                parent.record->>'name' AS parent_name
FROM app_records op
LEFT JOIN app_records coa
  ON coa.table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
 AND coa.record->>'systemKey'='CASH:' || op.id
LEFT JOIN app_records parent
  ON parent.table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
 AND parent.id=coa.record->>'parentId'
WHERE op.table_name='accounts:$TARGET_WORKSPACE_ID'
ORDER BY op.record->>'type',op.record->>'name';"

echo
echo "[4] Dependency kendaraan -> supplier"
psql_db "SELECT v.record->>'plateNumber' AS kendaraan,
                v.record->>'name' AS nama,
                v.record->>'supplierId' AS supplier_id,
                s.record->>'code' AS supplier_code,
                s.record->>'name' AS supplier_name,
                CASE WHEN COALESCE(v.record->>'supplierId','')='' THEN 'NOT_REQUIRED'
                     WHEN s.id IS NOT NULL THEN 'OK' ELSE 'ORPHAN' END AS status
FROM app_records v
LEFT JOIN app_records s
  ON s.table_name='suppliers:$TARGET_WORKSPACE_ID' AND s.id=v.record->>'supplierId'
WHERE v.table_name='vehicles:$TARGET_WORKSPACE_ID'
ORDER BY v.record->>'plateNumber';"

echo
echo "[5] Dependency tarif -> kebun"
psql_db "SELECT r.id AS rate_id,
                r.record->>'effectiveDate' AS effective_date,
                r.record->>'kebunId' AS kebun_id,
                k.record->>'code' AS kebun_code,
                k.record->>'name' AS kebun_name,
                CASE WHEN k.id IS NOT NULL THEN 'OK' ELSE 'ORPHAN' END AS status
FROM app_records r
LEFT JOIN app_records k
  ON k.table_name='kebun:$TARGET_WORKSPACE_ID' AND k.id=r.record->>'kebunId'
WHERE r.table_name='rates:$TARGET_WORKSPACE_ID'
ORDER BY r.record->>'effectiveDate';"

echo
echo "[6] Akun Penting target tetap utuh"
psql_db "SELECT COUNT(*) AS total_mapping,
                COUNT(*) FILTER (WHERE COALESCE(record->>'accountId','')<>'') AS mapped
FROM app_records WHERE table_name='accounting_system_mappings:$TARGET_WORKSPACE_ID';"

echo
echo "[7] Transaksi target masih kosong"
psql_db "SELECT x.kind, COUNT(r.id) AS rows
FROM (VALUES
 ('transactions'),('purchase_invoices'),('supplier_bills'),('supplier_payments'),
 ('inventory_usages'),('inventory_transfers'),('inventory_stocktakes'),
 ('tbs'),('tbs_payments'),('tbs_cost_payments'),('payroll_manual'),('payroll_runs'),
 ('employee_receivables'),('fixed_assets'),('manual_journals'),('opening_balances'),('work_entries')
) AS x(kind)
LEFT JOIN app_records r ON r.table_name=x.kind || ':$TARGET_WORKSPACE_ID'
GROUP BY x.kind ORDER BY x.kind;"

echo
echo "[8] Source tetap utuh"
psql_db "SELECT COUNT(*) AS source_business_rows
FROM app_records
WHERE RIGHT(table_name,LENGTH('$SOURCE_WORKSPACE_ID')+1)=':' || '$SOURCE_WORKSPACE_ID';"

echo
echo "=== END POST MIGRATION AUDIT ==="
