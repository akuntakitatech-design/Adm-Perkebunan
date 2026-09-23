#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
WORKSPACE_ID="${1:-ws-mu2utgvx-rf4bjhrn}"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

echo "=== POST OPENING BALANCE AUDIT · READ ONLY ==="
echo "WORKSPACE=$WORKSPACE_ID"
echo "Tidak ada INSERT/UPDATE/DELETE di script ini."

echo
echo "[1] Status posting Saldo Awal"
psql_db "WITH latest_opening AS (
  SELECT id, record, created_at, updated_at
  FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC
  LIMIT 1
), settings AS (
  SELECT record
  FROM app_records
  WHERE table_name='accounting_settings:$WORKSPACE_ID'
  ORDER BY updated_at DESC
  LIMIT 1
)
SELECT
  o.id AS opening_id,
  o.record->>'cutoffDate' AS cutoff,
  o.record->>'status' AS opening_status,
  COALESCE(o.record->>'postedAt','') AS posted_at,
  COALESCE(o.record->>'totalDebit','0') AS stored_debit,
  COALESCE(o.record->>'totalCredit','0') AS stored_credit,
  jsonb_array_length(COALESCE(o.record->'postedLines','[]'::jsonb)) AS posted_lines,
  COALESCE(s.record->>'setupComplete','false') AS setup_complete,
  COALESCE(s.record->>'openingPosted','false') AS settings_opening_posted
FROM latest_opening o CROSS JOIN settings s;"

echo
echo "[2] Validasi postedLines: balance, total, dan referensi akun"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), lines AS (
  SELECT x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'postedLines','[]'::jsonb)) x(value)
), sums AS (
  SELECT
    COALESCE(SUM(COALESCE(NULLIF(value->>'debit','')::numeric,0)),0) AS debit,
    COALESCE(SUM(COALESCE(NULLIF(value->>'credit','')::numeric,0)),0) AS credit,
    COUNT(*) AS line_count,
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM app_records a
      WHERE a.table_name='accounting_accounts:$WORKSPACE_ID' AND a.id=value->>'accountId'
    )) AS orphan_accounts
  FROM lines
)
SELECT
  s.line_count,
  s.debit AS posted_debit,
  s.credit AS posted_credit,
  s.debit-s.credit AS difference,
  COALESCE(NULLIF(ob.record->>'totalDebit','')::numeric,0) AS stored_debit,
  COALESCE(NULLIF(ob.record->>'totalCredit','')::numeric,0) AS stored_credit,
  s.orphan_accounts,
  CASE
    WHEN s.line_count=0 THEN 'EMPTY_POSTED_LINES'
    WHEN s.debit<>s.credit THEN 'NOT_BALANCED'
    WHEN s.orphan_accounts>0 THEN 'ORPHAN_ACCOUNT'
    WHEN s.debit<>COALESCE(NULLIF(ob.record->>'totalDebit','')::numeric,0)
      OR s.credit<>COALESCE(NULLIF(ob.record->>'totalCredit','')::numeric,0) THEN 'TOTAL_MISMATCH'
    ELSE 'OK'
  END AS status
FROM ob CROSS JOIN sums s;"

echo
echo "[3] Rekonsiliasi sumber draft vs postedLines"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), general_sum AS (
  SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'debit','')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE(NULLIF(x->>'credit','')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'generalLines','[]'::jsonb)) x
), sub_sum AS (
  SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'debit','')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE(NULLIF(x->>'credit','')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'subledgers','[]'::jsonb)) x
), asset_sum AS (
  SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'acquisitionCost','')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE(NULLIF(x->>'accumulatedDepreciation','')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'fixedAssets','[]'::jsonb)) x
), posted_sum AS (
  SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'debit','')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE(NULLIF(x->>'credit','')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'postedLines','[]'::jsonb)) x
)
SELECT
  g.debit+s.debit+a.debit AS source_debit,
  g.credit+s.credit+a.credit AS source_credit,
  p.debit AS posted_debit,
  p.credit AS posted_credit,
  (g.debit+s.debit+a.debit)-p.debit AS debit_difference,
  (g.credit+s.credit+a.credit)-p.credit AS credit_difference,
  CASE WHEN g.debit+s.debit+a.debit=p.debit AND g.credit+s.credit+a.credit=p.credit THEN 'OK' ELSE 'MISMATCH' END AS status
FROM general_sum g CROSS JOIN sub_sum s CROSS JOIN asset_sum a CROSS JOIN posted_sum p;"

echo
echo "[4] Cek double input akun CONTROLLED pada generalLines"
psql_db "WITH controlled AS (
  SELECT id, record->>'code' AS code, record->>'name' AS name, 'CASH_BANK' AS control_kind
  FROM app_records WHERE table_name='accounting_accounts:$WORKSPACE_ID' AND COALESCE(record->>'systemKey','') LIKE 'CASH:%'
  UNION
  SELECT id, record->>'code', record->>'name',
         CASE record->>'systemKey' WHEN 'AR_PKS' THEN 'PKS' WHEN 'AR_EMPLOYEE' THEN 'EMPLOYEE' WHEN 'AP_SUPPLIER' THEN 'SUPPLIER' ELSE 'SYSTEM' END
  FROM app_records WHERE table_name='accounting_accounts:$WORKSPACE_ID' AND COALESCE(record->>'systemKey','') IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER')
  UNION
  SELECT coa.id, coa.record->>'code', coa.record->>'name', 'INVENTORY'
  FROM app_records g JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=g.record->>'inventoryAccountId'
  WHERE g.table_name='inventory_groups:$WORKSPACE_ID' AND lower(COALESCE(g.record->>'canStore','false'))='true'
  UNION
  SELECT coa.id, coa.record->>'code', coa.record->>'name', 'FIXED_ASSET'
  FROM app_records g JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=g.record->>'assetAccountId'
  WHERE g.table_name='fixed_asset_groups:$WORKSPACE_ID'
  UNION
  SELECT coa.id, coa.record->>'code', coa.record->>'name', 'FIXED_ASSET_ACCUM_DEP'
  FROM app_records g JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=g.record->>'accumulatedDepreciationAccountId'
  WHERE g.table_name='fixed_asset_groups:$WORKSPACE_ID' AND COALESCE(g.record->>'accumulatedDepreciationAccountId','')<>''
), ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), lines AS (
  SELECT x.ordinality AS line_no, x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) WITH ORDINALITY x(value, ordinality)
)
SELECT l.line_no, c.code, c.name, c.control_kind,
       COALESCE(l.value->>'debit','0') AS debit,
       COALESCE(l.value->>'credit','0') AS credit,
       'DUPLICATE_RISK' AS status
FROM lines l JOIN controlled c ON c.id=l.value->>'accountId'
WHERE COALESCE(NULLIF(l.value->>'debit','')::numeric,0)<>0 OR COALESCE(NULLIF(l.value->>'credit','')::numeric,0)<>0
ORDER BY l.line_no;"

echo
echo "[5] Rekonsiliasi Saldo Awal Kas & Bank ke master operasional"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), expected AS (
  SELECT x.value->>'entityId' AS entity_id,
         SUM(COALESCE(NULLIF(x.value->>'debit','')::numeric,0)-COALESCE(NULLIF(x.value->>'credit','')::numeric,0)) AS expected_opening
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x(value)
  WHERE x.value->>'kind'='CASH_BANK'
  GROUP BY x.value->>'entityId'
)
SELECT a.record->>'name' AS account_name,
       a.record->>'type' AS type,
       COALESCE(e.expected_opening,0) AS expected_opening,
       COALESCE(NULLIF(a.record->>'openingBalance','')::numeric,0) AS actual_opening,
       COALESCE(NULLIF(a.record->>'openingBalance','')::numeric,0)-COALESCE(e.expected_opening,0) AS difference,
       CASE WHEN ABS(COALESCE(NULLIF(a.record->>'openingBalance','')::numeric,0)-COALESCE(e.expected_opening,0))<1 THEN 'OK' ELSE 'MISMATCH' END AS status
FROM app_records a
LEFT JOIN expected e ON e.entity_id=a.id
WHERE a.table_name='accounts:$WORKSPACE_ID'
ORDER BY a.record->>'type', a.record->>'name';"

echo
echo "[6] Rekonsiliasi Persediaan Saldo Awal"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), cutoff AS (
  SELECT record->>'cutoffDate' AS d FROM ob
), expected AS (
  SELECT x.value->>'entityId' AS entity_id,
         SUM(COALESCE(NULLIF(COALESCE(x.value->>'inputQuantity',x.value->>'quantity'),'')::numeric,0)) AS expected_qty,
         SUM(COALESCE(NULLIF(x.value->>'debit','')::numeric,0)-COALESCE(NULLIF(x.value->>'credit','')::numeric,0)) AS expected_value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x(value)
  WHERE x.value->>'kind'='INVENTORY'
  GROUP BY x.value->>'entityId'
), activity AS (
  SELECT
    (SELECT COUNT(*) FROM app_records r, cutoff c WHERE r.table_name='purchase_invoices:$WORKSPACE_ID' AND COALESCE(r.record->>'date','')>c.d)
    +
    (SELECT COUNT(*) FROM app_records r, cutoff c WHERE r.table_name='inventory_usages:$WORKSPACE_ID' AND COALESCE(r.record->>'date','')>c.d) AS post_cutoff_rows
)
SELECT i.record->>'code' AS item_code,
       i.record->>'name' AS item_name,
       COALESCE(e.expected_qty,0) AS expected_qty,
       COALESCE(NULLIF(i.record->>'openingQuantity','')::numeric,0) AS actual_opening_qty,
       CASE WHEN COALESCE(e.expected_qty,0)=0 THEN 0 ELSE ROUND(COALESCE(e.expected_value,0)/e.expected_qty,4) END AS expected_avg_cost,
       COALESCE(NULLIF(i.record->>'openingAverageCost','')::numeric,0) AS actual_opening_avg_cost,
       COALESCE(e.expected_value,0) AS expected_value,
       COALESCE(NULLIF(i.record->>'stockValue','')::numeric,0) AS current_stock_value,
       COALESCE(NULLIF(i.record->>'currentQuantity','')::numeric,0) AS current_qty,
       a.post_cutoff_rows,
       CASE
         WHEN ABS(COALESCE(NULLIF(i.record->>'openingQuantity','')::numeric,0)-COALESCE(e.expected_qty,0))>=0.0001 THEN 'MISMATCH_OPENING_QTY'
         WHEN ABS(COALESCE(NULLIF(i.record->>'openingAverageCost','')::numeric,0)-(CASE WHEN COALESCE(e.expected_qty,0)=0 THEN 0 ELSE COALESCE(e.expected_value,0)/e.expected_qty END))>=0.01 THEN 'MISMATCH_OPENING_AVG'
         WHEN a.post_cutoff_rows=0 AND ABS(COALESCE(NULLIF(i.record->>'currentQuantity','')::numeric,0)-COALESCE(e.expected_qty,0))>=0.0001 THEN 'MISMATCH_CURRENT_QTY'
         WHEN a.post_cutoff_rows=0 AND ABS(COALESCE(NULLIF(i.record->>'stockValue','')::numeric,0)-COALESCE(e.expected_value,0))>=1 THEN 'MISMATCH_STOCK_VALUE'
         ELSE 'OK'
       END AS status
FROM app_records i
LEFT JOIN expected e ON e.entity_id=i.id
CROSS JOIN activity a
WHERE i.table_name='inventory_items:$WORKSPACE_ID'
ORDER BY i.record->>'code';"

echo
echo "[7] Rekonsiliasi Aset Tetap yang masuk Saldo Awal"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), rows AS (
  SELECT x.ordinality AS line_no, x.value,
         COALESCE(NULLIF(x.value->>'assetId',''), NULLIF(x.value->>'id','')) AS asset_id
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) WITH ORDINALITY x(value, ordinality)
)
SELECT r.line_no,
       COALESCE(a.record->>'code','?') AS asset_code,
       COALESCE(a.record->>'name','ASET TIDAK DITEMUKAN') AS asset_name,
       COALESCE(NULLIF(r.value->>'acquisitionCost','')::numeric,0) AS expected_cost,
       COALESCE(NULLIF(a.record->>'acquisitionCost','')::numeric,0) AS master_cost,
       COALESCE(NULLIF(r.value->>'accumulatedDepreciation','')::numeric,0) AS expected_accum_dep,
       COALESCE(NULLIF(a.record->>'openingAccumulatedDepreciation','')::numeric,0) AS master_opening_accum_dep,
       COALESCE(k.record->>'code','') AS kebun_code,
       COALESCE(ca.record->>'code','') AS asset_coa,
       COALESCE(cd.record->>'code','') AS accum_dep_coa,
       CASE
         WHEN a.id IS NULL THEN 'ORPHAN_ASSET'
         WHEN ABS(COALESCE(NULLIF(r.value->>'acquisitionCost','')::numeric,0)-COALESCE(NULLIF(a.record->>'acquisitionCost','')::numeric,0))>=1 THEN 'COST_MISMATCH'
         WHEN ABS(COALESCE(NULLIF(r.value->>'accumulatedDepreciation','')::numeric,0)-COALESCE(NULLIF(a.record->>'openingAccumulatedDepreciation','')::numeric,0))>=1 THEN 'ACCUM_DEP_MISMATCH'
         WHEN g.id IS NULL OR ca.id IS NULL THEN 'MAPPING_MISSING'
         WHEN lower(COALESCE(g.record->>'depreciable','false'))='true' AND cd.id IS NULL THEN 'ACCUM_DEP_MAPPING_MISSING'
         ELSE 'OK'
       END AS status
FROM rows r
LEFT JOIN app_records a ON a.table_name='fixed_assets:$WORKSPACE_ID' AND a.id=r.asset_id
LEFT JOIN app_records g ON g.table_name='fixed_asset_groups:$WORKSPACE_ID' AND g.id=a.record->>'groupId'
LEFT JOIN app_records k ON k.table_name='kebun:$WORKSPACE_ID' AND k.id=a.record->>'kebunId'
LEFT JOIN app_records ca ON ca.table_name='accounting_accounts:$WORKSPACE_ID' AND ca.id=g.record->>'assetAccountId'
LEFT JOIN app_records cd ON cd.table_name='accounting_accounts:$WORKSPACE_ID' AND cd.id=g.record->>'accumulatedDepreciationAccountId'
ORDER BY r.line_no;"

echo
echo "[8] Neraca per tanggal cut-off dari postedLines"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), lines AS (
  SELECT x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'postedLines','[]'::jsonb)) x(value)
), joined AS (
  SELECT a.record->>'group' AS grp,
         COALESCE(NULLIF(l.value->>'debit','')::numeric,0) AS debit,
         COALESCE(NULLIF(l.value->>'credit','')::numeric,0) AS credit
  FROM lines l
  LEFT JOIN app_records a ON a.table_name='accounting_accounts:$WORKSPACE_ID' AND a.id=l.value->>'accountId'
), totals AS (
  SELECT
    COALESCE(SUM(CASE WHEN grp='ASSET' THEN debit-credit ELSE 0 END),0) AS assets,
    COALESCE(SUM(CASE WHEN grp='LIABILITY' THEN credit-debit ELSE 0 END),0) AS liabilities,
    COALESCE(SUM(CASE WHEN grp='EQUITY' THEN credit-debit ELSE 0 END),0) AS equity,
    COUNT(*) FILTER (WHERE grp IN ('REVENUE','EXPENSE')) AS pnl_lines,
    COUNT(*) FILTER (WHERE grp IS NULL) AS orphan_lines
  FROM joined
)
SELECT assets, liabilities, equity,
       liabilities+equity AS liabilities_plus_equity,
       assets-(liabilities+equity) AS difference,
       pnl_lines, orphan_lines,
       CASE
         WHEN orphan_lines>0 THEN 'ORPHAN_ACCOUNT'
         WHEN pnl_lines>0 THEN 'CHECK_PNL_OPENING_LINES'
         WHEN ABS(assets-(liabilities+equity))<1 THEN 'SEIMBANG'
         ELSE 'TIDAK_SEIMBANG'
       END AS status
FROM totals;"

echo
echo "[9] Periode akuntansi setelah posting"
psql_db "SELECT record->>'periodKey' AS period,
       record->>'status' AS status,
       record->>'startDate' AS start_date,
       record->>'endDate' AS end_date
FROM app_records
WHERE table_name='accounting_periods:$WORKSPACE_ID'
ORDER BY record->>'periodKey';"

echo
echo "[10] Kesimpulan pasca-posting"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID' AND record->>'status'='POSTED'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), st AS (
  SELECT record FROM app_records
  WHERE table_name='accounting_settings:$WORKSPACE_ID'
  ORDER BY updated_at DESC LIMIT 1
), posted AS (
  SELECT x.value FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'postedLines','[]'::jsonb)) x(value)
), posted_check AS (
  SELECT COUNT(*) AS n,
         COALESCE(SUM(COALESCE(NULLIF(value->>'debit','')::numeric,0)),0) AS d,
         COALESCE(SUM(COALESCE(NULLIF(value->>'credit','')::numeric,0)),0) AS c,
         COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM app_records a WHERE a.table_name='accounting_accounts:$WORKSPACE_ID' AND a.id=value->>'accountId')) AS orphan
  FROM posted
), source_check AS (
  SELECT
    (SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'debit','')::numeric,0)),0) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) x)
    +(SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'debit','')::numeric,0)),0) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x)
    +(SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'acquisitionCost','')::numeric,0)),0) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) x) AS d,
    (SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'credit','')::numeric,0)),0) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) x)
    +(SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'credit','')::numeric,0)),0) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x)
    +(SELECT COALESCE(SUM(COALESCE(NULLIF(x->>'accumulatedDepreciation','')::numeric,0)),0) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) x) AS c
), controlled AS (
  SELECT id FROM app_records WHERE table_name='accounting_accounts:$WORKSPACE_ID' AND (COALESCE(record->>'systemKey','') LIKE 'CASH:%' OR COALESCE(record->>'systemKey','') IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER'))
  UNION SELECT record->>'inventoryAccountId' FROM app_records WHERE table_name='inventory_groups:$WORKSPACE_ID' AND lower(COALESCE(record->>'canStore','false'))='true'
  UNION SELECT record->>'assetAccountId' FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID'
  UNION SELECT record->>'accumulatedDepreciationAccountId' FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID' AND COALESCE(record->>'accumulatedDepreciationAccountId','')<>''
), controlled_dup AS (
  SELECT COUNT(*) AS n
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) x(value)
  WHERE x.value->>'accountId' IN (SELECT id FROM controlled)
    AND (COALESCE(NULLIF(x.value->>'debit','')::numeric,0)<>0 OR COALESCE(NULLIF(x.value->>'credit','')::numeric,0)<>0)
), cash_expected AS (
  SELECT x.value->>'entityId' AS id,
         SUM(COALESCE(NULLIF(x.value->>'debit','')::numeric,0)-COALESCE(NULLIF(x.value->>'credit','')::numeric,0)) AS amount
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x(value)
  WHERE x.value->>'kind'='CASH_BANK' GROUP BY x.value->>'entityId'
), cash_bad AS (
  SELECT COUNT(*) AS n
  FROM app_records a LEFT JOIN cash_expected e ON e.id=a.id
  WHERE a.table_name='accounts:$WORKSPACE_ID'
    AND ABS(COALESCE(NULLIF(a.record->>'openingBalance','')::numeric,0)-COALESCE(e.amount,0))>=1
), inv_expected AS (
  SELECT x.value->>'entityId' AS id,
         SUM(COALESCE(NULLIF(COALESCE(x.value->>'inputQuantity',x.value->>'quantity'),'')::numeric,0)) AS qty,
         SUM(COALESCE(NULLIF(x.value->>'debit','')::numeric,0)-COALESCE(NULLIF(x.value->>'credit','')::numeric,0)) AS value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x(value)
  WHERE x.value->>'kind'='INVENTORY' GROUP BY x.value->>'entityId'
), inv_bad AS (
  SELECT COUNT(*) AS n
  FROM app_records i LEFT JOIN inv_expected e ON e.id=i.id
  WHERE i.table_name='inventory_items:$WORKSPACE_ID'
    AND (
      ABS(COALESCE(NULLIF(i.record->>'openingQuantity','')::numeric,0)-COALESCE(e.qty,0))>=0.0001
      OR ABS(COALESCE(NULLIF(i.record->>'openingAverageCost','')::numeric,0)-(CASE WHEN COALESCE(e.qty,0)=0 THEN 0 ELSE COALESCE(e.value,0)/e.qty END))>=0.01
    )
), fa_rows AS (
  SELECT x.value, COALESCE(NULLIF(x.value->>'assetId',''),NULLIF(x.value->>'id','')) AS asset_id
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) x(value)
), fa_bad AS (
  SELECT COUNT(*) AS n
  FROM fa_rows r
  LEFT JOIN app_records a ON a.table_name='fixed_assets:$WORKSPACE_ID' AND a.id=r.asset_id
  LEFT JOIN app_records g ON g.table_name='fixed_asset_groups:$WORKSPACE_ID' AND g.id=a.record->>'groupId'
  LEFT JOIN app_records ca ON ca.table_name='accounting_accounts:$WORKSPACE_ID' AND ca.id=g.record->>'assetAccountId'
  LEFT JOIN app_records cd ON cd.table_name='accounting_accounts:$WORKSPACE_ID' AND cd.id=g.record->>'accumulatedDepreciationAccountId'
  WHERE a.id IS NULL
     OR ABS(COALESCE(NULLIF(r.value->>'acquisitionCost','')::numeric,0)-COALESCE(NULLIF(a.record->>'acquisitionCost','')::numeric,0))>=1
     OR ABS(COALESCE(NULLIF(r.value->>'accumulatedDepreciation','')::numeric,0)-COALESCE(NULLIF(a.record->>'openingAccumulatedDepreciation','')::numeric,0))>=1
     OR g.id IS NULL OR ca.id IS NULL
     OR (lower(COALESCE(g.record->>'depreciable','false'))='true' AND cd.id IS NULL)
), bs AS (
  SELECT
    COALESCE(SUM(CASE WHEN a.record->>'group'='ASSET' THEN COALESCE(NULLIF(p.value->>'debit','')::numeric,0)-COALESCE(NULLIF(p.value->>'credit','')::numeric,0) ELSE 0 END),0) AS assets,
    COALESCE(SUM(CASE WHEN a.record->>'group'='LIABILITY' THEN COALESCE(NULLIF(p.value->>'credit','')::numeric,0)-COALESCE(NULLIF(p.value->>'debit','')::numeric,0) ELSE 0 END),0) AS liabilities,
    COALESCE(SUM(CASE WHEN a.record->>'group'='EQUITY' THEN COALESCE(NULLIF(p.value->>'credit','')::numeric,0)-COALESCE(NULLIF(p.value->>'debit','')::numeric,0) ELSE 0 END),0) AS equity,
    COUNT(*) FILTER (WHERE a.record->>'group' IN ('REVENUE','EXPENSE')) AS pnl_lines
  FROM posted p LEFT JOIN app_records a ON a.table_name='accounting_accounts:$WORKSPACE_ID' AND a.id=p.value->>'accountId'
)
SELECT
  pc.n AS posted_lines,
  pc.d AS posted_debit,
  pc.c AS posted_credit,
  pc.orphan AS orphan_accounts,
  sc.d AS source_debit,
  sc.c AS source_credit,
  cd.n AS controlled_general_duplicates,
  cb.n AS cash_mismatches,
  ib.n AS inventory_mismatches,
  fb.n AS fixed_asset_mismatches,
  bs.assets-(bs.liabilities+bs.equity) AS balance_sheet_difference,
  bs.pnl_lines AS pnl_opening_lines,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM ob) THEN 'BLOCKED_NO_POSTED_OPENING'
    WHEN lower(COALESCE(st.record->>'openingPosted','false'))<>'true' THEN 'BLOCKED_SETTINGS_NOT_POSTED'
    WHEN pc.n=0 THEN 'BLOCKED_EMPTY_POSTED_LINES'
    WHEN pc.d<>pc.c THEN 'BLOCKED_POSTED_JOURNAL_NOT_BALANCED'
    WHEN pc.orphan>0 THEN 'BLOCKED_ORPHAN_ACCOUNT'
    WHEN sc.d<>pc.d OR sc.c<>pc.c THEN 'BLOCKED_SOURCE_POSTED_MISMATCH'
    WHEN cd.n>0 THEN 'BLOCKED_CONTROLLED_DUPLICATE'
    WHEN cb.n>0 THEN 'BLOCKED_CASH_OPENING_MISMATCH'
    WHEN ib.n>0 THEN 'BLOCKED_INVENTORY_OPENING_MISMATCH'
    WHEN fb.n>0 THEN 'BLOCKED_FIXED_ASSET_MISMATCH'
    WHEN bs.pnl_lines>0 THEN 'REVIEW_PNL_LINES_IN_OPENING'
    WHEN ABS(bs.assets-(bs.liabilities+bs.equity))>=1 THEN 'BLOCKED_BALANCE_SHEET_NOT_BALANCED'
    ELSE 'PASS_POST_OPENING'
  END AS final_status
FROM posted_check pc CROSS JOIN source_check sc CROSS JOIN controlled_dup cd CROSS JOIN cash_bad cb CROSS JOIN inv_bad ib CROSS JOIN fa_bad fb CROSS JOIN bs CROSS JOIN st;"
