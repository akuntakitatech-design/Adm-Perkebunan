#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
WORKSPACE_ID="ws-mu2utgvx-rf4bjhrn"
cd "$APP_DIR"

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

echo "=== OPENING BALANCE DRAFT AUDIT · READ ONLY ==="
echo "WORKSPACE=$WORKSPACE_ID"
echo "Tidak ada INSERT/UPDATE/DELETE di script ini."

echo
echo "[1] Status draft dan ringkasan tersimpan"
psql_db "SELECT id,
  record->>'cutoffDate' AS cutoff,
  record->>'status' AS status,
  COALESCE(record->>'totalDebit','0') AS stored_debit,
  COALESCE(record->>'totalCredit','0') AS stored_credit,
  jsonb_array_length(COALESCE(record->'generalLines','[]'::jsonb)) AS general_lines,
  jsonb_array_length(COALESCE(record->'subledgers','[]'::jsonb)) AS subledger_lines,
  jsonb_array_length(COALESCE(record->'fixedAssets','[]'::jsonb)) AS fixed_asset_lines,
  record->>'createdAt' AS created_at,
  record->>'updatedAt' AS updated_at
FROM app_records
WHERE table_name='opening_balances:$WORKSPACE_ID'
ORDER BY updated_at DESC, created_at DESC;"

echo
echo "[2] Rekalkulasi debit / kredit draft"
psql_db "WITH ob AS (
  SELECT record FROM app_records
  WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), general_sum AS (
  SELECT COALESCE(SUM(COALESCE((x->>'debit')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE((x->>'credit')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'generalLines','[]'::jsonb)) x
), sub_sum AS (
  SELECT COALESCE(SUM(COALESCE((x->>'debit')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE((x->>'credit')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'subledgers','[]'::jsonb)) x
), asset_sum AS (
  SELECT COALESCE(SUM(COALESCE((x->>'acquisitionCost')::numeric,0)),0) AS debit,
         COALESCE(SUM(COALESCE((x->>'accumulatedDepreciation')::numeric,0)),0) AS credit
  FROM ob, LATERAL jsonb_array_elements(COALESCE(record->'fixedAssets','[]'::jsonb)) x
)
SELECT g.debit AS general_debit, g.credit AS general_credit,
       s.debit AS subledger_debit, s.credit AS subledger_credit,
       a.debit AS fixed_asset_debit, a.credit AS fixed_asset_credit,
       g.debit+s.debit+a.debit AS computed_debit,
       g.credit+s.credit+a.credit AS computed_credit,
       (g.debit+s.debit+a.debit)-(g.credit+s.credit+a.credit) AS difference,
       CASE WHEN g.debit+s.debit+a.debit = g.credit+s.credit+a.credit
                 AND g.debit+s.debit+a.debit > 0 THEN 'BALANCED'
            WHEN g.debit+s.debit+a.debit = 0 AND g.credit+s.credit+a.credit = 0 THEN 'EMPTY'
            ELSE 'NOT_BALANCED' END AS balance_status
FROM general_sum g CROSS JOIN sub_sum s CROSS JOIN asset_sum a;"

echo
echo "[3] General lines yang terisi"
psql_db "WITH ob AS (
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
)
SELECT x.ordinality AS line_no,
       COALESCE(c.record->>'code','?') AS coa_code,
       COALESCE(c.record->>'name','AKUN TIDAK DITEMUKAN') AS coa_name,
       COALESCE(x.value->>'debit','0') AS debit,
       COALESCE(x.value->>'credit','0') AS credit,
       COALESCE(k.record->>'code','') AS kebun_code,
       COALESCE(k.record->>'name','') AS kebun_name,
       COALESCE(x.value->>'memo',x.value->>'description','') AS memo
FROM ob,
LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) WITH ORDINALITY AS x(value, ordinality)
LEFT JOIN app_records c ON c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.id=x.value->>'accountId'
LEFT JOIN app_records k ON k.table_name='kebun:$WORKSPACE_ID' AND k.id=x.value->>'kebunId'
WHERE COALESCE((x.value->>'debit')::numeric,0)<>0 OR COALESCE((x.value->>'credit')::numeric,0)<>0
ORDER BY x.ordinality;"

echo
echo "[4] Cek general line memakai akun CONTROLLED (potensi double input)"
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
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), lines AS (
  SELECT x.ordinality AS line_no, x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) WITH ORDINALITY x(value, ordinality)
)
SELECT l.line_no, c.code, c.name, c.control_kind,
       COALESCE(l.value->>'debit','0') AS debit,
       COALESCE(l.value->>'credit','0') AS credit,
       'CHECK_DUPLICATE_WITH_SUBLEDGER' AS status
FROM lines l JOIN controlled c ON c.id=l.value->>'accountId'
WHERE COALESCE((l.value->>'debit')::numeric,0)<>0 OR COALESCE((l.value->>'credit')::numeric,0)<>0
ORDER BY l.line_no;"

echo
echo "[5] Detail subledger yang terisi"
psql_db "WITH ob AS (
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), rows AS (
  SELECT x.ordinality AS line_no, x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) WITH ORDINALITY x(value, ordinality)
)
SELECT r.line_no,
       r.value->>'kind' AS kind,
       COALESCE(coa.record->>'code','?') AS coa_code,
       COALESCE(coa.record->>'name','AKUN TIDAK DITEMUKAN') AS coa_name,
       CASE r.value->>'kind'
         WHEN 'CASH_BANK' THEN COALESCE(cash.record->>'name','ENTITAS TIDAK DITEMUKAN')
         WHEN 'PKS' THEN COALESCE(mill.record->>'name','ENTITAS TIDAK DITEMUKAN')
         WHEN 'EMPLOYEE' THEN COALESCE(emp.record->>'name','ENTITAS TIDAK DITEMUKAN')
         WHEN 'SUPPLIER' THEN COALESCE(sup.record->>'name','ENTITAS TIDAK DITEMUKAN')
         WHEN 'INVENTORY' THEN COALESCE(inv.record->>'code','') || CASE WHEN inv.id IS NOT NULL THEN ' · ' ELSE '' END || COALESCE(inv.record->>'name','ENTITAS TIDAK DITEMUKAN')
         ELSE COALESCE(r.value->>'entityId','')
       END AS entity,
       COALESCE(r.value->>'description','') AS description,
       COALESCE(r.value->>'reference','') AS reference,
       COALESCE(r.value->>'amount','0') AS amount,
       COALESCE(r.value->>'debit','0') AS debit,
       COALESCE(r.value->>'credit','0') AS credit,
       COALESCE(r.value->>'inputQuantity',r.value->>'quantity','') AS qty,
       COALESCE(r.value->>'inputUnit','') AS unit,
       COALESCE(r.value->>'inputUnitCost',r.value->>'unitCost','') AS unit_cost
FROM rows r
LEFT JOIN app_records coa ON coa.table_name='accounting_accounts:$WORKSPACE_ID' AND coa.id=r.value->>'accountId'
LEFT JOIN app_records cash ON cash.table_name='accounts:$WORKSPACE_ID' AND cash.id=r.value->>'entityId'
LEFT JOIN app_records mill ON mill.table_name='mills:$WORKSPACE_ID' AND mill.id=r.value->>'entityId'
LEFT JOIN app_records emp ON emp.table_name='harvesters:$WORKSPACE_ID' AND emp.id=r.value->>'entityId'
LEFT JOIN app_records sup ON sup.table_name='suppliers:$WORKSPACE_ID' AND sup.id=r.value->>'entityId'
LEFT JOIN app_records inv ON inv.table_name='inventory_items:$WORKSPACE_ID' AND inv.id=r.value->>'entityId'
WHERE COALESCE((r.value->>'amount')::numeric,0)<>0
   OR COALESCE((r.value->>'debit')::numeric,0)<>0
   OR COALESCE((r.value->>'credit')::numeric,0)<>0
   OR COALESCE((r.value->>'quantity')::numeric,0)<>0
   OR COALESCE((r.value->>'inputQuantity')::numeric,0)<>0
ORDER BY r.line_no;"

echo
echo "[6] Validasi referensi dan mapping subledger"
psql_db "WITH maps AS (
  SELECT record->>'key' AS k, record->>'accountId' AS account_id
  FROM app_records WHERE table_name='accounting_system_mappings:$WORKSPACE_ID'
), ob AS (
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), rows AS (
  SELECT x.ordinality AS line_no, x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) WITH ORDINALITY x(value, ordinality)
), checked AS (
  SELECT r.*,
    CASE r.value->>'kind'
      WHEN 'CASH_BANK' THEN (SELECT c.id FROM app_records c WHERE c.table_name='accounting_accounts:$WORKSPACE_ID' AND c.record->>'systemKey'='CASH:' || (r.value->>'entityId') LIMIT 1)
      WHEN 'PKS' THEN (SELECT account_id FROM maps WHERE k='AR_PKS' LIMIT 1)
      WHEN 'EMPLOYEE' THEN (SELECT account_id FROM maps WHERE k='AR_EMPLOYEE' LIMIT 1)
      WHEN 'SUPPLIER' THEN (SELECT account_id FROM maps WHERE k='AP_SUPPLIER' LIMIT 1)
      WHEN 'INVENTORY' THEN (
        SELECT g.record->>'inventoryAccountId'
        FROM app_records i JOIN app_records g ON g.table_name='inventory_groups:$WORKSPACE_ID' AND g.id=i.record->>'groupId'
        WHERE i.table_name='inventory_items:$WORKSPACE_ID' AND i.id=r.value->>'entityId' LIMIT 1)
      ELSE NULL
    END AS expected_account_id,
    CASE r.value->>'kind'
      WHEN 'CASH_BANK' THEN EXISTS (SELECT 1 FROM app_records e WHERE e.table_name='accounts:$WORKSPACE_ID' AND e.id=r.value->>'entityId')
      WHEN 'PKS' THEN EXISTS (SELECT 1 FROM app_records e WHERE e.table_name='mills:$WORKSPACE_ID' AND e.id=r.value->>'entityId')
      WHEN 'EMPLOYEE' THEN EXISTS (SELECT 1 FROM app_records e WHERE e.table_name='harvesters:$WORKSPACE_ID' AND e.id=r.value->>'entityId')
      WHEN 'SUPPLIER' THEN EXISTS (SELECT 1 FROM app_records e WHERE e.table_name='suppliers:$WORKSPACE_ID' AND e.id=r.value->>'entityId')
      WHEN 'INVENTORY' THEN EXISTS (SELECT 1 FROM app_records e WHERE e.table_name='inventory_items:$WORKSPACE_ID' AND e.id=r.value->>'entityId')
      ELSE false
    END AS entity_ok
  FROM rows r
)
SELECT line_no, value->>'kind' AS kind,
       value->>'entityId' AS entity_id,
       value->>'accountId' AS actual_account_id,
       expected_account_id,
       CASE
         WHEN NOT entity_ok THEN 'ORPHAN_ENTITY'
         WHEN expected_account_id IS NULL THEN 'MAPPING_MISSING'
         WHEN value->>'accountId' IS DISTINCT FROM expected_account_id THEN 'WRONG_ACCOUNT_MAPPING'
         WHEN COALESCE((value->>'debit')::numeric,0)<0 OR COALESCE((value->>'credit')::numeric,0)<0 THEN 'NEGATIVE_DEBIT_CREDIT'
         WHEN value->>'kind'='INVENTORY' AND COALESCE((value->>'quantity')::numeric,0)<=0 THEN 'INVALID_INVENTORY_QTY'
         ELSE 'OK'
       END AS status
FROM checked
WHERE COALESCE((value->>'amount')::numeric,0)<>0
   OR COALESCE((value->>'debit')::numeric,0)<>0
   OR COALESCE((value->>'credit')::numeric,0)<>0
   OR COALESCE((value->>'quantity')::numeric,0)<>0
ORDER BY line_no;"

echo
echo "[7] Duplikasi entity subledger yang perlu direview"
psql_db "WITH ob AS (
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), rows AS (
  SELECT x.value FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x(value)
  WHERE COALESCE((x.value->>'amount')::numeric,0)<>0
     OR COALESCE((x.value->>'debit')::numeric,0)<>0
     OR COALESCE((x.value->>'credit')::numeric,0)<>0
     OR COALESCE((x.value->>'quantity')::numeric,0)<>0
)
SELECT value->>'kind' AS kind, value->>'entityId' AS entity_id,
       COUNT(*) AS line_count,
       SUM(COALESCE((value->>'debit')::numeric,0)) AS total_debit,
       SUM(COALESCE((value->>'credit')::numeric,0)) AS total_credit,
       CASE WHEN COUNT(*)>1 THEN 'REVIEW_MULTIPLE_LINES' ELSE 'OK' END AS status
FROM rows
GROUP BY value->>'kind', value->>'entityId'
HAVING COUNT(*)>1
ORDER BY kind, entity_id;"

echo
echo "[8] Aset Tetap yang otomatis ditarik ke draft"
psql_db "WITH ob AS (
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), rows AS (
  SELECT x.ordinality AS line_no, x.value
  FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) WITH ORDINALITY x(value, ordinality)
)
SELECT r.line_no,
       COALESCE(a.record->>'code','?') AS asset_code,
       COALESCE(a.record->>'name','ASET TIDAK DITEMUKAN') AS asset_name,
       COALESCE(c1.record->>'code','?') AS asset_coa,
       COALESCE(c2.record->>'code','') AS accum_dep_coa,
       COALESCE(r.value->>'acquisitionCost','0') AS acquisition_cost,
       COALESCE(r.value->>'accumulatedDepreciation','0') AS accumulated_depreciation,
       COALESCE(k.record->>'code','') AS kebun_code
FROM rows r
LEFT JOIN app_records a ON a.table_name='fixed_assets:$WORKSPACE_ID' AND a.id=r.value->>'assetId'
LEFT JOIN app_records c1 ON c1.table_name='accounting_accounts:$WORKSPACE_ID' AND c1.id=r.value->>'assetAccountId'
LEFT JOIN app_records c2 ON c2.table_name='accounting_accounts:$WORKSPACE_ID' AND c2.id=r.value->>'accumulatedDepreciationAccountId'
LEFT JOIN app_records k ON k.table_name='kebun:$WORKSPACE_ID' AND k.id=r.value->>'kebunId'
ORDER BY r.line_no;"

echo
echo "[9] Operational opening fields harus masih nol selama status DRAFT"
psql_db "SELECT 'CASH_BANK' AS kind, record->>'name' AS entity,
       COALESCE(record->>'openingBalance','0') AS opening_value,
       CASE WHEN COALESCE((record->>'openingBalance')::numeric,0)=0 THEN 'OK_DRAFT_NOT_POSTED' ELSE 'CHECK_ALREADY_APPLIED' END AS status
FROM app_records WHERE table_name='accounts:$WORKSPACE_ID'
UNION ALL
SELECT 'INVENTORY', COALESCE(record->>'code','') || ' · ' || COALESCE(record->>'name',''),
       'qty=' || COALESCE(record->>'openingQuantity','0') || ', avg=' || COALESCE(record->>'openingAverageCost','0') || ', current=' || COALESCE(record->>'currentQuantity','0') || ', value=' || COALESCE(record->>'stockValue','0'),
       CASE WHEN COALESCE((record->>'openingQuantity')::numeric,0)=0 AND COALESCE((record->>'stockValue')::numeric,0)=0 THEN 'OK_DRAFT_NOT_POSTED' ELSE 'CHECK_ALREADY_APPLIED' END
FROM app_records WHERE table_name='inventory_items:$WORKSPACE_ID'
ORDER BY kind, entity;"

echo
echo "[10] Kesimpulan draft"
psql_db "WITH ob AS (
  SELECT record FROM app_records WHERE table_name='opening_balances:$WORKSPACE_ID'
  ORDER BY updated_at DESC, created_at DESC LIMIT 1
), controlled AS (
  SELECT id FROM app_records WHERE table_name='accounting_accounts:$WORKSPACE_ID' AND COALESCE(record->>'systemKey','') LIKE 'CASH:%'
  UNION SELECT id FROM app_records WHERE table_name='accounting_accounts:$WORKSPACE_ID' AND COALESCE(record->>'systemKey','') IN ('AR_PKS','AR_EMPLOYEE','AP_SUPPLIER')
  UNION SELECT record->>'inventoryAccountId' FROM app_records WHERE table_name='inventory_groups:$WORKSPACE_ID' AND lower(COALESCE(record->>'canStore','false'))='true'
  UNION SELECT record->>'assetAccountId' FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID'
  UNION SELECT record->>'accumulatedDepreciationAccountId' FROM app_records WHERE table_name='fixed_asset_groups:$WORKSPACE_ID' AND COALESCE(record->>'accumulatedDepreciationAccountId','')<>''
), general_lines AS (
  SELECT x.value FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'generalLines','[]'::jsonb)) x(value)
), sub_lines AS (
  SELECT x.value FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'subledgers','[]'::jsonb)) x(value)
), calc AS (
  SELECT
    COALESCE((SELECT SUM(COALESCE((value->>'debit')::numeric,0)) FROM general_lines),0)
      + COALESCE((SELECT SUM(COALESCE((value->>'debit')::numeric,0)) FROM sub_lines),0)
      + COALESCE((SELECT SUM(COALESCE((x->>'acquisitionCost')::numeric,0)) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) x),0) AS debit,
    COALESCE((SELECT SUM(COALESCE((value->>'credit')::numeric,0)) FROM general_lines),0)
      + COALESCE((SELECT SUM(COALESCE((value->>'credit')::numeric,0)) FROM sub_lines),0)
      + COALESCE((SELECT SUM(COALESCE((x->>'accumulatedDepreciation')::numeric,0)) FROM ob, LATERAL jsonb_array_elements(COALESCE(ob.record->'fixedAssets','[]'::jsonb)) x),0) AS credit,
    (SELECT COUNT(*) FROM general_lines g JOIN controlled c ON c.id=g.value->>'accountId' WHERE COALESCE((g.value->>'debit')::numeric,0)<>0 OR COALESCE((g.value->>'credit')::numeric,0)<>0) AS controlled_general_lines,
    (SELECT COUNT(*) FROM sub_lines WHERE COALESCE((value->>'amount')::numeric,0)<>0 OR COALESCE((value->>'debit')::numeric,0)<>0 OR COALESCE((value->>'credit')::numeric,0)<>0 OR COALESCE((value->>'quantity')::numeric,0)<>0) AS filled_subledger_lines
)
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM ob) THEN 'BLOCKED_NO_DRAFT'
  WHEN (SELECT record->>'status' FROM ob)='POSTED' THEN 'ALREADY_POSTED'
  WHEN calc.controlled_general_lines>0 THEN 'BLOCKED_CONTROLLED_ACCOUNT_IN_GENERAL_LINES'
  WHEN calc.debit=0 AND calc.credit=0 THEN 'DRAFT_EMPTY'
  WHEN calc.debit<>calc.credit THEN 'DRAFT_NOT_BALANCED'
  ELSE 'DRAFT_BALANCED_REVIEW_DETAILS_BEFORE_POST'
END AS draft_status,
calc.debit AS computed_debit,
calc.credit AS computed_credit,
calc.debit-calc.credit AS difference,
calc.controlled_general_lines,
calc.filled_subledger_lines
FROM calc;"

echo
echo "=== END OPENING BALANCE DRAFT AUDIT ==="
