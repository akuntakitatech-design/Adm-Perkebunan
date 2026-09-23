#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
SOURCE_WORKSPACE_ID="f6233ad0442e68812cf057e9fea7e76d"
TARGET_WORKSPACE_ID="ws-mu2utgvx-rf4bjhrn"
cd "$APP_DIR"

psql_value() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq' <<< "$1" | tr -d '\r' | head -n 1
}

psql_db() {
  docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"
}

echo "=== MIGRASI MASTER LEGACY -> PERKEBUNAN SAWIT SW ==="
echo "SOURCE=$SOURCE_WORKSPACE_ID"
echo "TARGET=$TARGET_WORKSPACE_ID"
echo "Sumber TIDAK akan dihapus."
echo

if [ -f scripts/backup.sh ]; then
  echo "[1/5] Membuat full backup sebelum migrasi..."
  bash scripts/backup.sh
else
  echo "ERROR: scripts/backup.sh tidak ditemukan. Migrasi dibatalkan." >&2
  exit 1
fi

ALREADY_DONE="$(psql_value "WITH expected(kind, cnt) AS (
  VALUES ('accounts',2),('harvesters',2),('kebun',1),('mills',4),('rates',1),('suppliers',1),('vehicles',2)
), checks AS (
  SELECT e.kind,
         e.cnt,
         COUNT(t.id) AS copied
  FROM expected e
  LEFT JOIN app_records s ON s.table_name=e.kind || ':$SOURCE_WORKSPACE_ID'
  LEFT JOIN app_records t ON t.table_name=e.kind || ':$TARGET_WORKSPACE_ID' AND t.id=s.id
  GROUP BY e.kind,e.cnt
)
SELECT CASE
  WHEN BOOL_AND(copied=cnt)
   AND (SELECT COUNT(*) FROM app_records WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID' AND COALESCE(record->>'systemKey','') LIKE 'CASH:%') >= 2
  THEN 'YES' ELSE 'NO' END
FROM checks;")"

if [ "$ALREADY_DONE" = "YES" ]; then
  echo "Migrasi terlihat sudah pernah selesai. Tidak ada data yang ditulis ulang."
  echo "Jalankan: bash scripts/post-migration-sawit-sw-audit.sh"
  exit 0
fi

echo "[2/5] Menjalankan migrasi dalam satu transaksi database..."
docker compose exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<SQL
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('legacy-sawit-sw-master-migration-v2'));

DO \$\$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='accounts:$SOURCE_WORKSPACE_ID';
  IF n <> 2 THEN RAISE EXCEPTION 'Source accounts berubah: expected 2, actual %', n; END IF;
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='harvesters:$SOURCE_WORKSPACE_ID';
  IF n <> 2 THEN RAISE EXCEPTION 'Source harvesters berubah: expected 2, actual %', n; END IF;
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='kebun:$SOURCE_WORKSPACE_ID';
  IF n <> 1 THEN RAISE EXCEPTION 'Source kebun berubah: expected 1, actual %', n; END IF;
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='mills:$SOURCE_WORKSPACE_ID';
  IF n <> 4 THEN RAISE EXCEPTION 'Source mills berubah: expected 4, actual %', n; END IF;
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='rates:$SOURCE_WORKSPACE_ID';
  IF n <> 1 THEN RAISE EXCEPTION 'Source rates berubah: expected 1, actual %', n; END IF;
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='suppliers:$SOURCE_WORKSPACE_ID';
  IF n <> 1 THEN RAISE EXCEPTION 'Source suppliers berubah: expected 1, actual %', n; END IF;
  SELECT COUNT(*) INTO n FROM app_records WHERE table_name='vehicles:$SOURCE_WORKSPACE_ID';
  IF n <> 2 THEN RAISE EXCEPTION 'Source vehicles berubah: expected 2, actual %', n; END IF;
END
\$\$;

DO \$\$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n
  FROM app_records
  WHERE table_name IN (
    'transactions:$TARGET_WORKSPACE_ID','purchase_invoices:$TARGET_WORKSPACE_ID',
    'supplier_bills:$TARGET_WORKSPACE_ID','supplier_payments:$TARGET_WORKSPACE_ID',
    'inventory_usages:$TARGET_WORKSPACE_ID','inventory_transfers:$TARGET_WORKSPACE_ID',
    'inventory_stocktakes:$TARGET_WORKSPACE_ID','tbs:$TARGET_WORKSPACE_ID',
    'tbs_payments:$TARGET_WORKSPACE_ID','tbs_cost_payments:$TARGET_WORKSPACE_ID',
    'payroll_manual:$TARGET_WORKSPACE_ID','payroll_runs:$TARGET_WORKSPACE_ID',
    'employee_receivables:$TARGET_WORKSPACE_ID','fixed_assets:$TARGET_WORKSPACE_ID',
    'manual_journals:$TARGET_WORKSPACE_ID','opening_balances:$TARGET_WORKSPACE_ID',
    'work_entries:$TARGET_WORKSPACE_ID'
  );
  IF n <> 0 THEN RAISE EXCEPTION 'Target sudah memiliki transaksi/subledger (% rows). Migrasi dibatalkan.', n; END IF;
END
\$\$;

DO \$\$
DECLARE
  n integer;
BEGIN
  WITH src AS (
    SELECT 'kebun' kind, lower(COALESCE(record->>'code','')) nk FROM app_records WHERE table_name='kebun:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'supplier', lower(COALESCE(record->>'code','')) FROM app_records WHERE table_name='suppliers:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'harvester', lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='harvesters:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'mill', lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='mills:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'account', lower(COALESCE(record->>'name','')) || '|' || COALESCE(record->>'type','') FROM app_records WHERE table_name='accounts:$SOURCE_WORKSPACE_ID'
    UNION ALL SELECT 'vehicle', lower(COALESCE(record->>'plateNumber','')) FROM app_records WHERE table_name='vehicles:$SOURCE_WORKSPACE_ID'
  ), tgt AS (
    SELECT 'kebun' kind, lower(COALESCE(record->>'code','')) nk FROM app_records WHERE table_name='kebun:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'supplier', lower(COALESCE(record->>'code','')) FROM app_records WHERE table_name='suppliers:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'harvester', lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='harvesters:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'mill', lower(COALESCE(record->>'name','')) FROM app_records WHERE table_name='mills:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'account', lower(COALESCE(record->>'name','')) || '|' || COALESCE(record->>'type','') FROM app_records WHERE table_name='accounts:$TARGET_WORKSPACE_ID'
    UNION ALL SELECT 'vehicle', lower(COALESCE(record->>'plateNumber','')) FROM app_records WHERE table_name='vehicles:$TARGET_WORKSPACE_ID'
  )
  SELECT COUNT(*) INTO n FROM src JOIN tgt USING(kind,nk);
  IF n <> 0 THEN RAISE EXCEPTION 'Ditemukan % collision natural key di target. Migrasi dibatalkan.', n; END IF;
END
\$\$;

-- Resolve parent COA kas/bank berdasarkan parent source yang sama di template target.
-- Tidak lagi mengasumsikan kode parent 1101/1102 karena struktur hirarki template dapat berbeda.
CREATE TEMP TABLE target_cash_parent(
  source_cash_id text PRIMARY KEY,
  source_parent_id text NOT NULL,
  source_parent_code text NOT NULL,
  source_parent_name text NOT NULL,
  target_parent_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO target_cash_parent(source_cash_id, source_parent_id, source_parent_code, source_parent_name, target_parent_id)
SELECT cash.id,
       src_parent.id,
       src_parent.record->>'code',
       src_parent.record->>'name',
       tgt_parent.id
FROM app_records cash
JOIN app_records src_parent
  ON src_parent.table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
 AND src_parent.id=cash.record->>'parentId'
JOIN app_records tgt_parent
  ON tgt_parent.table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
 AND tgt_parent.record->>'code'=src_parent.record->>'code'
 AND COALESCE(tgt_parent.record->>'level','')=COALESCE(src_parent.record->>'level','')
 AND COALESCE(tgt_parent.record->>'name','')=COALESCE(src_parent.record->>'name','')
 AND lower(COALESCE(tgt_parent.record->>'posting','false'))=lower(COALESCE(src_parent.record->>'posting','false'))
WHERE cash.table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
  AND COALESCE(cash.record->>'systemKey','') LIKE 'CASH:%';

DO \$\$
DECLARE
  source_cash_count integer;
  mapped_parent_count integer;
  n integer;
BEGIN
  SELECT COUNT(*) INTO source_cash_count
  FROM app_records
  WHERE table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
    AND COALESCE(record->>'systemKey','') LIKE 'CASH:%';

  SELECT COUNT(*) INTO mapped_parent_count FROM target_cash_parent;
  IF source_cash_count <> 2 THEN
    RAISE EXCEPTION 'Source COA CASH berubah: expected 2, actual %', source_cash_count;
  END IF;
  IF mapped_parent_count <> source_cash_count THEN
    RAISE EXCEPTION 'Parent COA kas/bank target belum dapat dipetakan lengkap: source cash %, mapped parent %', source_cash_count, mapped_parent_count;
  END IF;

  SELECT COUNT(*) INTO n
  FROM app_records
  WHERE table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
    AND (record->>'code' IN ('1101.001','1102.001') OR COALESCE(record->>'systemKey','') LIKE 'CASH:%');
  IF n <> 0 THEN RAISE EXCEPTION 'Target sudah memiliki COA kas/bank dinamis (% rows). Migrasi dibatalkan.', n; END IF;
END
\$\$;

SELECT source_cash_id, source_parent_code, source_parent_name, target_parent_id
FROM target_cash_parent
ORDER BY source_cash_id;

-- Master independen. ID lama dipertahankan karena primary key app_records adalah (table_name,id),
-- sehingga dependency lama tetap valid tetapi tetap terisolasi per workspace.
INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'kebun:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='kebun:$SOURCE_WORKSPACE_ID';

INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'suppliers:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='suppliers:$SOURCE_WORKSPACE_ID';

INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'harvesters:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='harvesters:$SOURCE_WORKSPACE_ID';

INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'mills:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='mills:$SOURCE_WORKSPACE_ID';

INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'accounts:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='accounts:$SOURCE_WORKSPACE_ID';

-- Buat ulang COA kas/bank dinamis dengan parent target, tetapi pertahankan ID COA dan operational-account ID.
INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'accounting_accounts:$TARGET_WORKSPACE_ID', s.id,
       jsonb_set(
         CASE WHEN s.record ? 'workspaceId' THEN jsonb_set(s.record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE s.record END,
         '{parentId}',
         to_jsonb(p.target_parent_id),
         true
       ),
       s.created_at, s.updated_at
FROM app_records s
JOIN target_cash_parent p ON p.source_cash_id=s.id
WHERE s.table_name='accounting_accounts:$SOURCE_WORKSPACE_ID'
  AND COALESCE(s.record->>'systemKey','') LIKE 'CASH:%';

-- Dependency aman karena ID master sumber dipertahankan di target.
INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'vehicles:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='vehicles:$SOURCE_WORKSPACE_ID';

INSERT INTO app_records(table_name,id,record,created_at,updated_at)
SELECT 'rates:$TARGET_WORKSPACE_ID', id,
       CASE WHEN record ? 'workspaceId' THEN jsonb_set(record,'{workspaceId}',to_jsonb('$TARGET_WORKSPACE_ID'::text),false) ELSE record END,
       created_at, updated_at
FROM app_records WHERE table_name='rates:$SOURCE_WORKSPACE_ID';

DO \$\$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) INTO n
  FROM app_records op
  JOIN app_records coa
    ON coa.table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
   AND coa.record->>'systemKey'='CASH:' || op.id
  WHERE op.table_name='accounts:$TARGET_WORKSPACE_ID';
  IF n <> 2 THEN RAISE EXCEPTION 'Validasi CASH gagal: expected 2, actual %', n; END IF;

  SELECT COUNT(*) INTO n
  FROM app_records v
  LEFT JOIN app_records s
    ON s.table_name='suppliers:$TARGET_WORKSPACE_ID' AND s.id=v.record->>'supplierId'
  WHERE v.table_name='vehicles:$TARGET_WORKSPACE_ID'
    AND COALESCE(v.record->>'supplierId','') <> ''
    AND s.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'Validasi kendaraan->supplier gagal: % orphan', n; END IF;

  SELECT COUNT(*) INTO n
  FROM app_records r
  LEFT JOIN app_records k
    ON k.table_name='kebun:$TARGET_WORKSPACE_ID' AND k.id=r.record->>'kebunId'
  WHERE r.table_name='rates:$TARGET_WORKSPACE_ID' AND k.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'Validasi tarif->kebun gagal: % orphan', n; END IF;
END
\$\$;

COMMIT;
SQL

echo "[3/5] Migrasi database COMMIT berhasil."
echo

echo "[4/5] Ringkasan target setelah migrasi"
psql_db "SELECT x.kind, COUNT(r.id) AS rows
FROM (VALUES ('kebun'),('accounts'),('suppliers'),('harvesters'),('mills'),('vehicles'),('rates')) AS x(kind)
LEFT JOIN app_records r ON r.table_name=x.kind || ':$TARGET_WORKSPACE_ID'
GROUP BY x.kind ORDER BY x.kind;"

psql_db "SELECT op.record->>'name' AS kas_bank,
                op.record->>'type' AS type,
                coa.record->>'code' AS coa_code,
                coa.record->>'name' AS coa_name,
                coa.record->>'systemKey' AS system_key
FROM app_records op
LEFT JOIN app_records coa
  ON coa.table_name='accounting_accounts:$TARGET_WORKSPACE_ID'
 AND coa.record->>'systemKey'='CASH:' || op.id
WHERE op.table_name='accounts:$TARGET_WORKSPACE_ID'
ORDER BY op.record->>'type', op.record->>'name';"

echo "[5/5] Selesai. Source workspace tetap utuh dan tidak dihapus."
echo "Selanjutnya jalankan: bash scripts/post-migration-sawit-sw-audit.sh"
