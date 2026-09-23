-- =====================================================================
-- Administrasi Perkebunan — Skema MariaDB
-- ---------------------------------------------------------------------
-- Aplikasi ini memakai pola penyimpanan dokumen: SEMUA entitas disimpan
-- di tabel `app_records` (satu baris = satu record JSON). Nama logis
-- entitas + workspace disimpan di kolom `table_name` dengan format
--   <entity>:<workspaceId>       (contoh: kebun:db8c4271...)
--
-- Agar data mudah dibaca di phpMyAdmin, disediakan VIEW `v_<entity>`
-- untuk setiap entitas yang membedah JSON menjadi kolom-kolom.
-- File ini idempoten (aman dijalankan berulang).
-- =====================================================================

CREATE TABLE IF NOT EXISTS app_records (
  table_name   VARCHAR(191) NOT NULL COMMENT 'Format <entity>:<workspaceId>',
  id           CHAR(36)     NOT NULL COMMENT 'UUID record',
  record       LONGTEXT     NOT NULL COMMENT 'Isi record dalam JSON' CHECK (JSON_VALID(record)),
  entity       VARCHAR(80)  AS (SUBSTRING_INDEX(table_name, ':', 1)) STORED COMMENT 'Nama entitas logis',
  workspace_id VARCHAR(120) AS (SUBSTRING_INDEX(table_name, ':', -1)) STORED COMMENT 'ID perusahaan/workspace (atau userId untuk tabel profil)',
  created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (table_name, id),
  KEY idx_app_records_table_created (table_name, created_at, id),
  KEY idx_app_records_entity_ws (entity, workspace_id),
  KEY idx_app_records_ws (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Penyimpanan utama seluruh data Administrasi Perkebunan (dokumen JSON)';

-- ---------------------------------------------------------------------
-- Ringkasan jumlah record per entitas per perusahaan
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ringkasan_data AS
SELECT entity AS entitas, workspace_id, COUNT(*) AS jumlah, MIN(created_at) AS pertama_dibuat, MAX(updated_at) AS terakhir_diubah
FROM app_records
GROUP BY entity, workspace_id;

-- ---------------------------------------------------------------------
-- Perusahaan / Workspace & Pengguna
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_perusahaan AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.name')          AS nama,
  JSON_VALUE(record, '$.shortName')     AS nama_singkat,
  JSON_VALUE(record, '$.businessType')  AS jenis_usaha,
  JSON_VALUE(record, '$.npwp')          AS npwp,
  JSON_VALUE(record, '$.address')       AS alamat,
  JSON_VALUE(record, '$.city')          AS kota,
  JSON_VALUE(record, '$.province')      AS provinsi,
  JSON_VALUE(record, '$.phone')         AS telepon,
  JSON_VALUE(record, '$.email')         AS email,
  JSON_VALUE(record, '$.ownerUserId')   AS owner_user_id,
  JSON_VALUE(record, '$.logoUrl')       AS logo_url,
  created_at, updated_at
FROM app_records WHERE entity = 'workspace_meta';

CREATE OR REPLACE VIEW v_anggota_perusahaan AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.userId') AS user_id,
  JSON_VALUE(record, '$.email')  AS email,
  JSON_VALUE(record, '$.name')   AS nama,
  JSON_VALUE(record, '$.role')   AS peran,
  JSON_QUERY(record, '$.assignedKebunIds') AS kebun_ditugaskan,
  JSON_VALUE(record, '$.joinedAt') AS bergabung_pada,
  created_at, updated_at
FROM app_records WHERE entity = 'workspace_members';

CREATE OR REPLACE VIEW v_keanggotaan_user AS
SELECT id, workspace_id AS user_id,
  JSON_VALUE(record, '$.workspaceId')   AS workspace_id,
  JSON_VALUE(record, '$.workspaceName') AS nama_perusahaan,
  JSON_VALUE(record, '$.role')          AS peran,
  JSON_VALUE(record, '$.joinedAt')      AS bergabung_pada,
  created_at, updated_at
FROM app_records WHERE entity = 'workspace_memberships';

CREATE OR REPLACE VIEW v_undangan AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.email')  AS email,
  JSON_VALUE(record, '$.role')   AS peran,
  JSON_VALUE(record, '$.status') AS status,
  JSON_VALUE(record, '$.createdBy') AS dibuat_oleh,
  JSON_VALUE(record, '$.acceptedAt') AS diterima_pada,
  created_at, updated_at
FROM app_records WHERE entity = 'workspace_invites';

CREATE OR REPLACE VIEW v_profil_user AS
SELECT id, workspace_id AS user_id,
  JSON_VALUE(record, '$.activeWorkspaceId') AS workspace_aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'workspace_profile';

-- ---------------------------------------------------------------------
-- Master Data
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kebun AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')      AS kode,
  JSON_VALUE(record, '$.name')      AS nama,
  JSON_VALUE(record, '$.owner')     AS pemilik,
  JSON_VALUE(record, '$.location')  AS lokasi,
  CAST(JSON_VALUE(record, '$.areaHa') AS DECIMAL(14,2))  AS luas_ha,
  CAST(JSON_VALUE(record, '$.treeCount') AS UNSIGNED)    AS jumlah_pohon,
  JSON_VALUE(record, '$.status')    AS status,
  created_at, updated_at
FROM app_records WHERE entity = 'kebun';

CREATE OR REPLACE VIEW v_kas_bank AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.name')          AS nama,
  JSON_VALUE(record, '$.type')          AS jenis,
  CAST(JSON_VALUE(record, '$.openingBalance') AS DECIMAL(18,2)) AS saldo_awal,
  JSON_VALUE(record, '$.bankName')      AS nama_bank,
  JSON_VALUE(record, '$.accountNumber') AS nomor_rekening,
  created_at, updated_at
FROM app_records WHERE entity = 'accounts';

CREATE OR REPLACE VIEW v_pks AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.name')     AS nama,
  JSON_VALUE(record, '$.location') AS lokasi,
  JSON_VALUE(record, '$.active')   AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'mills';

CREATE OR REPLACE VIEW v_tenaga_kerja AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.name')   AS nama,
  JSON_VALUE(record, '$.phone')  AS telepon,
  JSON_VALUE(record, '$.active') AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'harvesters';

CREATE OR REPLACE VIEW v_armada AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.plateNumber')   AS nomor_polisi,
  JSON_VALUE(record, '$.name')          AS nama,
  JSON_VALUE(record, '$.owner')         AS pemilik,
  JSON_VALUE(record, '$.ownershipType') AS kepemilikan,
  JSON_VALUE(record, '$.supplierId')    AS supplier_id,
  JSON_VALUE(record, '$.rentMode')      AS mode_sewa,
  CAST(JSON_VALUE(record, '$.defaultRate') AS DECIMAL(18,2)) AS tarif_default,
  JSON_VALUE(record, '$.active')        AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'vehicles';

CREATE OR REPLACE VIEW v_tarif_tbs AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.kebunId')       AS kebun_id,
  JSON_VALUE(record, '$.effectiveDate') AS tanggal_berlaku,
  CAST(JSON_VALUE(record, '$.harvestRatePerKg') AS DECIMAL(18,2))  AS tarif_panen_per_kg,
  JSON_VALUE(record, '$.harvestWeightBasis')                       AS basis_panen,
  JSON_VALUE(record, '$.weighingEnabled')                          AS timbang_aktif,
  CAST(JSON_VALUE(record, '$.weighingRatePerKg') AS DECIMAL(18,2)) AS tarif_timbang_per_kg,
  JSON_VALUE(record, '$.langsirEnabled')                           AS langsir_aktif,
  CAST(JSON_VALUE(record, '$.langsirRatePerKg') AS DECIMAL(18,2))  AS tarif_langsir_per_kg,
  JSON_VALUE(record, '$.langsirWeightBasis')                       AS basis_langsir,
  created_at, updated_at
FROM app_records WHERE entity = 'rates';

CREATE OR REPLACE VIEW v_supplier AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')    AS kode,
  JSON_VALUE(record, '$.name')    AS nama,
  JSON_VALUE(record, '$.contact') AS kontak,
  JSON_VALUE(record, '$.phone')   AS telepon,
  JSON_VALUE(record, '$.address') AS alamat,
  JSON_VALUE(record, '$.active')  AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'suppliers';

CREATE OR REPLACE VIEW v_master_pekerjaan AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.name')   AS nama,
  JSON_VALUE(record, '$.unit')   AS satuan,
  JSON_VALUE(record, '$.active') AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'work_types';

CREATE OR REPLACE VIEW v_tarif_pekerjaan AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.workTypeId')    AS pekerjaan_id,
  JSON_VALUE(record, '$.kebunId')       AS kebun_id,
  JSON_VALUE(record, '$.effectiveDate') AS tanggal_berlaku,
  CAST(JSON_VALUE(record, '$.rate') AS DECIMAL(18,2)) AS tarif,
  created_at, updated_at
FROM app_records WHERE entity = 'work_rates';

-- ---------------------------------------------------------------------
-- Transaksi Kas & Bank
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_transaksi_kas_bank AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.transactionNumber') AS nomor_transaksi,
  JSON_VALUE(record, '$.kind')        AS jenis,
  JSON_VALUE(record, '$.sourceType')  AS sumber,
  JSON_VALUE(record, '$.sourceId')    AS sumber_id,
  JSON_VALUE(record, '$.date')        AS tanggal,
  JSON_VALUE(record, '$.kebunId')     AS kebun_id,
  JSON_VALUE(record, '$.accountId')   AS kas_bank_id,
  JSON_VALUE(record, '$.direction')   AS arah,
  JSON_VALUE(record, '$.category')    AS kategori,
  JSON_VALUE(record, '$.description') AS keterangan,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2)) AS nominal,
  JSON_VALUE(record, '$.reference')   AS referensi,
  JSON_QUERY(record, '$.allocations') AS alokasi_akun,
  JSON_VALUE(record, '$.receiptPath') AS path_bukti,
  JSON_VALUE(record, '$.receiptName') AS nama_bukti,
  JSON_VALUE(record, '$.createdBy')   AS dibuat_oleh,
  created_at, updated_at
FROM app_records WHERE entity = 'transactions';

-- ---------------------------------------------------------------------
-- Panen & TBS
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tbs AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.date')        AS tanggal_lapangan,
  JSON_VALUE(record, '$.factoryDate') AS tanggal_pabrik,
  JSON_VALUE(record, '$.doNumber')    AS nomor_do,
  JSON_VALUE(record, '$.kebunId')     AS kebun_id,
  JSON_VALUE(record, '$.millId')      AS pks_id,
  JSON_VALUE(record, '$.harvesterId') AS pemanen_id,
  JSON_VALUE(record, '$.langsirWorkerId') AS pelangsir_id,
  JSON_VALUE(record, '$.vehicleId')   AS armada_id,
  CAST(JSON_VALUE(record, '$.fieldWeightKg') AS DECIMAL(18,2))   AS berat_lapangan_kg,
  CAST(JSON_VALUE(record, '$.factoryWeightKg') AS DECIMAL(18,2)) AS berat_pabrik_kg,
  CAST(JSON_VALUE(record, '$.pricePerKg') AS DECIMAL(18,2))      AS harga_per_kg,
  CAST(JSON_VALUE(record, '$.harvestCost') AS DECIMAL(18,2))     AS biaya_panen,
  CAST(JSON_VALUE(record, '$.weighingCost') AS DECIMAL(18,2))    AS biaya_timbang,
  CAST(JSON_VALUE(record, '$.langsirCost') AS DECIMAL(18,2))     AS biaya_langsir,
  CAST(JSON_VALUE(record, '$.transportCost') AS DECIMAL(18,2))   AS biaya_armada,
  CAST(JSON_VALUE(record, '$.grossRevenue') AS DECIMAL(18,2))    AS pendapatan_bruto,
  CAST(JSON_VALUE(record, '$.netRevenue') AS DECIMAL(18,2))      AS pendapatan_netto,
  CAST(JSON_VALUE(record, '$.directCost') AS DECIMAL(18,2))      AS biaya_langsung,
  CAST(JSON_VALUE(record, '$.margin') AS DECIMAL(18,2))          AS margin,
  JSON_VALUE(record, '$.status')      AS status,
  JSON_VALUE(record, '$.note')        AS catatan,
  created_at, updated_at
FROM app_records WHERE entity = 'tbs';

CREATE OR REPLACE VIEW v_pembayaran_tbs AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.paymentNumber') AS nomor_pembayaran,
  JSON_VALUE(record, '$.date')      AS tanggal,
  JSON_VALUE(record, '$.millId')    AS pks_id,
  JSON_VALUE(record, '$.accountId') AS kas_bank_id,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2)) AS nominal,
  JSON_VALUE(record, '$.reference') AS referensi,
  JSON_QUERY(record, '$.allocations') AS alokasi_do,
  created_at, updated_at
FROM app_records WHERE entity = 'tbs_payments';

CREATE OR REPLACE VIEW v_pembayaran_biaya_tbs AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.paymentNumber') AS nomor_pembayaran,
  JSON_VALUE(record, '$.date')         AS tanggal,
  JSON_VALUE(record, '$.component')    AS komponen,
  JSON_VALUE(record, '$.creditorName') AS penerima,
  JSON_VALUE(record, '$.accountId')    AS kas_bank_id,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2)) AS nominal,
  JSON_VALUE(record, '$.reference')    AS referensi,
  created_at, updated_at
FROM app_records WHERE entity = 'tbs_cost_payments';

-- ---------------------------------------------------------------------
-- Hutang Supplier
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tagihan_supplier AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.sourceType')    AS sumber,
  JSON_VALUE(record, '$.date')          AS tanggal,
  JSON_VALUE(record, '$.dueDate')       AS jatuh_tempo,
  JSON_VALUE(record, '$.supplierId')    AS supplier_id,
  JSON_VALUE(record, '$.kebunId')       AS kebun_id,
  JSON_VALUE(record, '$.invoiceNumber') AS nomor_faktur,
  JSON_VALUE(record, '$.category')      AS kategori,
  JSON_VALUE(record, '$.description')   AS keterangan,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2)) AS nominal,
  created_at, updated_at
FROM app_records WHERE entity = 'supplier_bills';

CREATE OR REPLACE VIEW v_pembayaran_supplier AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.paymentNumber') AS nomor_pembayaran,
  JSON_VALUE(record, '$.date')       AS tanggal,
  JSON_VALUE(record, '$.supplierId') AS supplier_id,
  JSON_VALUE(record, '$.accountId')  AS kas_bank_id,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2)) AS nominal,
  JSON_VALUE(record, '$.reference')  AS referensi,
  created_at, updated_at
FROM app_records WHERE entity = 'supplier_payments';

-- ---------------------------------------------------------------------
-- Pekerjaan Kebun, Piutang Karyawan & Payroll
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pekerjaan_kebun AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.date')       AS tanggal,
  JSON_VALUE(record, '$.kebunId')    AS kebun_id,
  JSON_VALUE(record, '$.workerId')   AS pekerja_id,
  JSON_VALUE(record, '$.workTypeId') AS pekerjaan_id,
  JSON_VALUE(record, '$.workName')   AS nama_pekerjaan,
  JSON_VALUE(record, '$.unit')       AS satuan,
  CAST(JSON_VALUE(record, '$.quantity') AS DECIMAL(18,2)) AS volume,
  CAST(JSON_VALUE(record, '$.rate') AS DECIMAL(18,2))     AS tarif,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2))   AS nominal,
  JSON_VALUE(record, '$.note')       AS catatan,
  created_at, updated_at
FROM app_records WHERE entity = 'work_entries';

CREATE OR REPLACE VIEW v_piutang_karyawan AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.date')        AS tanggal,
  JSON_VALUE(record, '$.workerId')    AS pekerja_id,
  JSON_VALUE(record, '$.accountId')   AS kas_bank_id,
  JSON_VALUE(record, '$.description') AS keterangan,
  CAST(JSON_VALUE(record, '$.totalAmount') AS DECIMAL(18,2)) AS total,
  CAST(JSON_VALUE(record, '$.installmentCount') AS UNSIGNED) AS jumlah_cicilan,
  created_at, updated_at
FROM app_records WHERE entity = 'employee_receivables';

CREATE OR REPLACE VIEW v_payroll_manual AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.date')     AS tanggal,
  JSON_VALUE(record, '$.workerId') AS pekerja_id,
  JSON_VALUE(record, '$.kebunId')  AS kebun_id,
  JSON_VALUE(record, '$.kind')     AS jenis,
  JSON_VALUE(record, '$.category') AS kategori,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2)) AS nominal,
  JSON_VALUE(record, '$.note')     AS catatan,
  created_at, updated_at
FROM app_records WHERE entity = 'payroll_manual';

CREATE OR REPLACE VIEW v_payroll AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.payrollNumber') AS nomor_payroll,
  JSON_VALUE(record, '$.periodStart')   AS periode_mulai,
  JSON_VALUE(record, '$.periodEnd')     AS periode_selesai,
  JSON_VALUE(record, '$.workerId')      AS pekerja_id,
  JSON_VALUE(record, '$.workerName')    AS nama_pekerja,
  CAST(JSON_VALUE(record, '$.grossEarnings') AS DECIMAL(18,2)) AS total_pendapatan,
  CAST(JSON_VALUE(record, '$.deductions') AS DECIMAL(18,2))    AS total_potongan,
  CAST(JSON_VALUE(record, '$.netPay') AS DECIMAL(18,2))        AS take_home_pay,
  JSON_VALUE(record, '$.status')        AS status,
  JSON_VALUE(record, '$.paymentDate')   AS tanggal_bayar,
  JSON_VALUE(record, '$.accountId')     AS kas_bank_id,
  JSON_QUERY(record, '$.lines')         AS rincian,
  created_at, updated_at
FROM app_records WHERE entity = 'payroll_runs';

-- ---------------------------------------------------------------------
-- Akuntansi
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_coa AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')          AS kode,
  JSON_VALUE(record, '$.name')          AS nama,
  JSON_VALUE(record, '$.group')         AS kelompok,
  JSON_VALUE(record, '$.normalBalance') AS saldo_normal,
  CAST(JSON_VALUE(record, '$.level') AS UNSIGNED) AS level,
  JSON_VALUE(record, '$.parentId')      AS parent_id,
  JSON_VALUE(record, '$.posting')       AS posting,
  JSON_VALUE(record, '$.systemKey')     AS kunci_sistem,
  JSON_VALUE(record, '$.cashFlowClass') AS kelas_arus_kas,
  JSON_VALUE(record, '$.active')        AS aktif,
  JSON_VALUE(record, '$.locked')        AS terkunci,
  created_at, updated_at
FROM app_records WHERE entity = 'accounting_accounts';

CREATE OR REPLACE VIEW v_akun_sistem AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.key')       AS kunci,
  JSON_VALUE(record, '$.accountId') AS akun_id,
  created_at, updated_at
FROM app_records WHERE entity = 'accounting_system_mappings';

CREATE OR REPLACE VIEW v_jurnal_manual AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.journalNumber') AS nomor_jurnal,
  JSON_VALUE(record, '$.date')          AS tanggal,
  JSON_VALUE(record, '$.description')   AS keterangan,
  JSON_VALUE(record, '$.reference')     AS referensi,
  JSON_VALUE(record, '$.sourceType')    AS sumber,
  JSON_QUERY(record, '$.lines')         AS baris_jurnal,
  created_at, updated_at
FROM app_records WHERE entity = 'manual_journals';

CREATE OR REPLACE VIEW v_pengaturan_akuntansi AS
SELECT id, workspace_id,
  CAST(JSON_VALUE(record, '$.fiscalYear') AS UNSIGNED)           AS tahun_fiskal,
  CAST(JSON_VALUE(record, '$.fiscalYearStartMonth') AS UNSIGNED) AS bulan_awal_fiskal,
  JSON_VALUE(record, '$.conversionDate') AS tanggal_konversi,
  JSON_VALUE(record, '$.setupComplete')  AS setup_selesai,
  JSON_VALUE(record, '$.openingPosted')  AS saldo_awal_diposting,
  created_at, updated_at
FROM app_records WHERE entity = 'accounting_settings';

CREATE OR REPLACE VIEW v_periode_akuntansi AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.periodKey') AS kunci_periode,
  JSON_VALUE(record, '$.label')     AS label,
  JSON_VALUE(record, '$.startDate') AS mulai,
  JSON_VALUE(record, '$.endDate')   AS selesai,
  JSON_VALUE(record, '$.status')    AS status,
  created_at, updated_at
FROM app_records WHERE entity = 'accounting_periods';

CREATE OR REPLACE VIEW v_saldo_awal AS
SELECT id, workspace_id, record AS isi, created_at, updated_at
FROM app_records WHERE entity = 'opening_balances';

-- ---------------------------------------------------------------------
-- Pembelian & Persediaan
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_faktur_pembelian AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.purchaseNumber') AS nomor_pembelian,
  JSON_VALUE(record, '$.date')           AS tanggal,
  JSON_VALUE(record, '$.dueDate')        AS jatuh_tempo,
  JSON_VALUE(record, '$.supplierId')     AS supplier_id,
  JSON_VALUE(record, '$.kebunId')        AS kebun_id,
  JSON_VALUE(record, '$.warehouseId')    AS gudang_id,
  JSON_VALUE(record, '$.invoiceNumber')  AS nomor_faktur,
  JSON_VALUE(record, '$.paymentType')    AS jenis_bayar,
  JSON_VALUE(record, '$.accountId')      AS kas_bank_id,
  CAST(JSON_VALUE(record, '$.subtotal') AS DECIMAL(18,2))       AS subtotal,
  CAST(JSON_VALUE(record, '$.discountAmount') AS DECIMAL(18,2)) AS diskon,
  CAST(JSON_VALUE(record, '$.vatAmount') AS DECIMAL(18,2))      AS ppn,
  CAST(JSON_VALUE(record, '$.amount') AS DECIMAL(18,2))         AS total,
  JSON_VALUE(record, '$.description')    AS keterangan,
  JSON_QUERY(record, '$.lines')          AS baris,
  created_at, updated_at
FROM app_records WHERE entity = 'purchase_invoices';

CREATE OR REPLACE VIEW v_kelompok_barang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code') AS kode,
  JSON_VALUE(record, '$.name') AS nama,
  JSON_VALUE(record, '$.canPurchase') AS bisa_beli,
  JSON_VALUE(record, '$.canStore')    AS bisa_simpan,
  JSON_VALUE(record, '$.canSell')     AS bisa_jual,
  JSON_VALUE(record, '$.purchaseAccountId')  AS akun_pembelian_id,
  JSON_VALUE(record, '$.inventoryAccountId') AS akun_persediaan_id,
  JSON_VALUE(record, '$.active') AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_groups';

CREATE OR REPLACE VIEW v_satuan_barang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')   AS kode,
  JSON_VALUE(record, '$.name')   AS nama,
  JSON_VALUE(record, '$.active') AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_units';

CREATE OR REPLACE VIEW v_barang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')    AS kode,
  JSON_VALUE(record, '$.name')    AS nama,
  JSON_VALUE(record, '$.groupId') AS kelompok_id,
  JSON_VALUE(record, '$.unitId')  AS satuan_id,
  CAST(JSON_VALUE(record, '$.openingQuantity') AS DECIMAL(18,4))    AS qty_awal,
  CAST(JSON_VALUE(record, '$.openingAverageCost') AS DECIMAL(18,2)) AS hpp_awal,
  CAST(JSON_VALUE(record, '$.currentQuantity') AS DECIMAL(18,4))    AS qty_saat_ini,
  CAST(JSON_VALUE(record, '$.averageCost') AS DECIMAL(18,2))        AS hpp_rata,
  CAST(JSON_VALUE(record, '$.stockValue') AS DECIMAL(18,2))         AS nilai_stok,
  JSON_VALUE(record, '$.active')  AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_items';

CREATE OR REPLACE VIEW v_gudang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')      AS kode,
  JSON_VALUE(record, '$.name')      AS nama,
  JSON_VALUE(record, '$.kebunId')   AS kebun_id,
  JSON_VALUE(record, '$.manager')   AS penanggung_jawab,
  JSON_VALUE(record, '$.isDefault') AS gudang_utama,
  JSON_VALUE(record, '$.active')    AS aktif,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_warehouses';

CREATE OR REPLACE VIEW v_saldo_gudang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.warehouseId') AS gudang_id,
  JSON_VALUE(record, '$.itemId')      AS barang_id,
  CAST(JSON_VALUE(record, '$.quantity') AS DECIMAL(18,4))    AS qty,
  CAST(JSON_VALUE(record, '$.averageCost') AS DECIMAL(18,2)) AS hpp_rata,
  CAST(JSON_VALUE(record, '$.stockValue') AS DECIMAL(18,2))  AS nilai_stok,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_warehouse_balances';

CREATE OR REPLACE VIEW v_pemakaian_barang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.usageNumber') AS nomor_pemakaian,
  JSON_VALUE(record, '$.date')        AS tanggal,
  JSON_VALUE(record, '$.warehouseId') AS gudang_id,
  JSON_VALUE(record, '$.reference')   AS referensi,
  JSON_VALUE(record, '$.description') AS keterangan,
  CAST(JSON_VALUE(record, '$.totalAmount') AS DECIMAL(18,2)) AS total,
  JSON_QUERY(record, '$.lines')       AS baris,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_usages';

CREATE OR REPLACE VIEW v_transfer_barang AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.transferNumber')         AS nomor_transfer,
  JSON_VALUE(record, '$.date')                   AS tanggal,
  JSON_VALUE(record, '$.sourceWarehouseId')      AS gudang_asal_id,
  JSON_VALUE(record, '$.destinationWarehouseId') AS gudang_tujuan_id,
  CAST(JSON_VALUE(record, '$.totalAmount') AS DECIMAL(18,2)) AS total,
  JSON_VALUE(record, '$.status')                 AS status,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_transfers';

CREATE OR REPLACE VIEW v_stock_opname AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.stocktakeNumber') AS nomor_opname,
  JSON_VALUE(record, '$.date')            AS tanggal,
  JSON_VALUE(record, '$.warehouseId')     AS gudang_id,
  JSON_VALUE(record, '$.pic')             AS pic,
  JSON_VALUE(record, '$.status')          AS status,
  CAST(JSON_VALUE(record, '$.totalAbsVarianceValue') AS DECIMAL(18,2)) AS total_selisih,
  created_at, updated_at
FROM app_records WHERE entity = 'inventory_stocktakes';

-- ---------------------------------------------------------------------
-- Aset Tetap
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kelompok_aset AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')               AS kode,
  JSON_VALUE(record, '$.name')               AS nama,
  JSON_VALUE(record, '$.depreciable')        AS disusutkan,
  JSON_VALUE(record, '$.depreciationMethod') AS metode_penyusutan,
  CAST(JSON_VALUE(record, '$.usefulLifeMonths') AS UNSIGNED) AS umur_bulan,
  JSON_VALUE(record, '$.assetAccountId')     AS akun_aset_id,
  created_at, updated_at
FROM app_records WHERE entity = 'fixed_asset_groups';

CREATE OR REPLACE VIEW v_aset_tetap AS
SELECT id, workspace_id,
  JSON_VALUE(record, '$.code')            AS kode,
  JSON_VALUE(record, '$.name')            AS nama,
  JSON_VALUE(record, '$.groupId')         AS kelompok_id,
  JSON_VALUE(record, '$.kebunId')         AS kebun_id,
  JSON_VALUE(record, '$.location')        AS lokasi,
  JSON_VALUE(record, '$.acquisitionDate') AS tanggal_perolehan,
  CAST(JSON_VALUE(record, '$.acquisitionCost') AS DECIMAL(18,2)) AS harga_perolehan,
  CAST(JSON_VALUE(record, '$.residualValue') AS DECIMAL(18,2))   AS nilai_residu,
  CAST(JSON_VALUE(record, '$.usefulLifeMonths') AS UNSIGNED)     AS umur_bulan,
  JSON_VALUE(record, '$.depreciationMethod') AS metode_penyusutan,
  JSON_VALUE(record, '$.status')          AS status,
  created_at, updated_at
FROM app_records WHERE entity = 'fixed_assets';
