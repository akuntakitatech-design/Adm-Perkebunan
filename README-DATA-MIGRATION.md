# Status migrasi data AppDeploy

ZIP source AppDeploy hanya berisi **program/source code**, bukan isi database produksi dan bukan file bukti transaksi.

Karena itu paket ini belum berisi data master/transaksi lama.

## Yang harus dimigrasikan terpisah

- workspace, membership, member dan invite;
- kebun dan Kas/Bank;
- PKS, tenaga kerja, armada dan tarif;
- transaksi Kas/Bank dan bukti transaksi;
- TBS dan penerimaan PKS;
- supplier, hutang dan pembayaran;
- pekerjaan kebun;
- payroll dan piutang karyawan;
- COA, setup akun penting, jurnal, periode dan saldo awal;
- pembelian;
- persediaan, gudang, pemakaian, transfer, stok opname;
- aset tetap.

## Perlindungan penting

Routine `RESET-TRANSACTIONS-2026-09-15` dan `RESET-COA-2026-09-15` yang ada pada source AppDeploy **dinonaktifkan pada frontend versi VPS**. Ini sengaja dilakukan agar data hasil migrasi tidak terhapus pada login pertama.

## Format database self-host awal

PostgreSQL memakai tabel kompatibilitas:

```text
app_records
- table_name
- id
- record (JSONB)
- created_at
- updated_at
```

Nama tabel logis AppDeploy (`transactions:<workspaceId>`, `kebun:<workspaceId>`, dst.) tetap dapat dipertahankan. ID menggunakan TEXT sehingga ID lama AppDeploy dapat dipertahankan saat import.

Pendekatan ini dipilih untuk meminimalkan risiko perubahan perilaku bisnis saat cutover. Normalisasi tabel PostgreSQL dapat dilakukan bertahap setelah hasil VPS sudah sama dengan aplikasi lama.
