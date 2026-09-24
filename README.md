# Administrasi Perkebunan

Aplikasi web untuk **administrasi kebun kelapa sawit**: pencatatan panen & penjualan TBS ke PKS, pekerjaan kebun dan payroll pekerja, kas & bank, pembelian dan persediaan barang, aset tetap, hingga akuntansi (COA, jurnal, laba rugi, neraca). Mendukung **multi-perusahaan** (workspace) dengan peran pengguna (Owner, Admin Pusat, Finance, Admin Kebun, Viewer).

Panduan deploy di Coolify: lihat [`README-COOLIFY.md`](README-COOLIFY.md).

---

## 1. Overview Project

Administrasi Perkebunan membantu pemilik/pengelola kebun mencatat operasional harian dan langsung melihat dampaknya ke laporan keuangan:

| Modul | Fungsi |
|---|---|
| **Dashboard** | Ringkasan saldo kas/bank, pemasukan/pengeluaran, produksi TBS, pembelian, persediaan, payroll, dan daftar hal yang perlu perhatian. |
| **Panen & TBS** | Timbangan lapangan per DO, timbangan pabrik (bruto/tara/potongan/harga), piutang PKS dan penerimaan pembayaran, biaya panen/langsir/armada. |
| **Pekerjaan Kebun** | Master pekerjaan (nunas, semprot, pupuk, ...) dengan tarif per kebun; input volume kerja per pekerja. |
| **Payroll Kebun** | Review pendapatan pekerja per periode (panen, timbang, langsir, pekerjaan), potongan piutang, proses payroll terpilih, slip gaji A4, pembayaran via kas/bank. |
| **Piutang Karyawan** | Pinjaman karyawan dengan cicilan yang dipotong saat payroll. |
| **Kas & Bank** | Transaksi masuk/keluar dengan alokasi akun COA dan cost center kebun, transfer antar akun, bukti transaksi (foto/PDF), buku kas & bank. |
| **Pembelian & Persediaan** | Faktur pembelian (tunai/kredit, diskon, PPN), hutang supplier & pembayaran, master barang/satuan/kelompok/gudang, pemakaian, transfer antar gudang, stock opname. |
| **Aset Tetap** | Kelompok & daftar aset, metode penyusutan, akun terkait. |
| **Akuntansi & Laporan** | Bagan akun (COA) 4 level, akun sistem, periode & saldo awal, jurnal manual, Laba Rugi, Neraca, Ringkasan TBS. |
| **Perusahaan** | Profil perusahaan, anggota & undangan, pindah perusahaan. |

---

## 2. Tech Stack

| Lapisan | Teknologi | Keterangan |
|---|---|---|
| **Frontend** | React 19 + TypeScript, Vite 6, Tailwind CSS 3, lucide-react | SPA dengan routing berbasis `history` (tanpa react-router). Disajikan oleh **Nginx** di produksi (proxy `/api` ke backend). |
| **Backend (API)** | Node.js 22 + **Express 4** (TypeScript, dijalankan via `tsx`) | Seluruh logika bisnis (`backend/backend/index.ts`). Router deklaratif `'METHOD /api/path': [middleware..., handler]`. |
| **Gateway preview** | **FastAPI** (Python) — `backend/server.py` | Hanya untuk lingkungan preview Emergent: menjalankan Node sebagai child process dan mem-proxy `/api` & `/uploads`. **Tidak** masuk image Docker produksi. |
| **Database** | **MariaDB 11** (kompatibel MySQL 8) via `mysql2` | Pola *document store*: satu tabel `app_records` (JSON) + 42 VIEW `v_*` agar terbaca di phpMyAdmin. Skema di `backend/database/schema.sql`, diterapkan otomatis saat start. |
| **Auth** | Email/password owner dari env + **JWT** (`jsonwebtoken`) di **cookie HttpOnly** `kebun_session` (12 jam) | Peran per perusahaan disimpan di `workspace_members`. Mendukung CORS + `SameSite=None` bila frontend beda domain. |
| **Storage** | **Cloudflare R2** (S3-compatible, `@aws-sdk/client-s3`) | Bukti transaksi & backup JSON saat hapus perusahaan. Presigned URL (privat) atau `R2_PUBLIC_URL`. Fallback disk lokal jika env `R2_*` kosong. |
| **Deploy** | Docker (multi-stage) + **Coolify** | `/backend/Dockerfile` (port 3000), `/frontend/Dockerfile` (Nginx port 80). |

---

## 3. Folder Structure

```
Adm-Perkebunan/
├── backend/                        # Resource Coolify: Backend-Perkebunan (Base Directory /backend)
│   ├── backend/
│   │   ├── index.ts                # SELURUH logika bisnis & definisi route API (~6.700 baris)
│   │   ├── localSdk.ts             # Compatibility layer: adapter DB (MariaDB), storage (R2/lokal), router, json/error
│   │   └── plantationCoa.ts        # Template bagan akun (COA) perkebunan
│   ├── server/
│   │   └── index.ts                # Entry Express: auth (login/me/logout), CORS, cookie, mount handler, /api/_system
│   ├── database/
│   │   └── schema.sql              # Tabel app_records + VIEW v_* (idempoten, dijalankan saat start)
│   ├── scripts/
│   │   ├── apply-schema.mjs        # Terapkan schema.sql manual
│   │   └── seed-dummy.mjs          # Isi data contoh lewat API (kebun, kas/bank, TBS, payroll, ...)
│   ├── server.py                   # Gateway FastAPI untuk preview Emergent (di-exclude dari Docker)
│   ├── requirements.txt            # Dependensi gateway Python (fastapi, uvicorn, httpx, python-dotenv)
│   ├── Dockerfile                  # Image produksi Node 22 alpine, healthcheck /api/_healthcheck
│   ├── .dockerignore
│   ├── .env.example                # Daftar lengkap variabel lingkungan backend
│   ├── package.json / yarn.lock
│   └── uploads/                    # (gitignored) storage lokal bila R2 tidak dikonfigurasi
│
├── frontend/                       # Resource Coolify: Frontend-Perkebunan (Base Directory /frontend)
│   ├── src/
│   │   ├── main.tsx                # Bootstrap React
│   │   ├── App.tsx                 # Membungkus FarmApp
│   │   ├── FarmApp.tsx             # Shell aplikasi: login, pemilih perusahaan, sidebar, routing tab, Dashboard, Master Data
│   │   ├── TbsModule.tsx           # Hub Panen & TBS
│   │   ├── TbsFieldEntry.tsx       # Timbangan lapangan (multi-kebun per DO)
│   │   ├── TbsMasters.tsx          # Master PKS, tenaga kerja, armada, tarif TBS
│   │   ├── TbsReceivables.tsx      # Piutang PKS & pembayaran TBS
│   │   ├── WorkModule.tsx          # Pekerjaan kebun (master, tarif, input volume)
│   │   ├── PayrollModule.tsx       # Review & proses payroll, pembayaran
│   │   ├── PayrollSlip.tsx         # Slip gaji (cetak A4 satu halaman)
│   │   ├── EmployeeReceivables.tsx # Piutang karyawan
│   │   ├── PurchaseInvoices.tsx    # Faktur pembelian, hutang & pembayaran supplier
│   │   ├── InventoryMasters.tsx    # Kelompok, satuan, barang, gudang
│   │   ├── InventoryUsage.tsx      # Pemakaian, transfer, stock opname
│   │   ├── FixedAssets.tsx         # Aset tetap
│   │   ├── AccountingModule.tsx    # Hub akuntansi
│   │   ├── AccountingFoundation.tsx# Periode, saldo awal, pengaturan
│   │   ├── AccountingReports.tsx   # Buku besar, neraca saldo, jurnal
│   │   ├── FinancialStatements.tsx # Laba Rugi, Neraca, Ringkasan TBS
│   │   ├── SystemAccounts.tsx      # Mapping akun sistem
│   │   ├── AccountSearchPicker.tsx # Komponen pencarian akun COA (reusable)
│   │   ├── navigationState.ts      # Persistensi pilihan menu di localStorage
│   │   ├── moneyInput.ts           # Format input Rupiah (1.000.000)
│   │   ├── lib/client.ts           # Wrapper fetch: api.get/post/put/delete + auth (cookie, pesan error ramah)
│   │   ├── farm.css                # Seluruh styling aplikasi (BEM-like, kelas `farm-*`)
│   │   └── index.css               # Import Tailwind base
│   ├── nginx/
│   │   ├── default.conf.template   # Template Nginx: SPA fallback, proxy /api & /uploads -> ${BACKEND_URL}
│   │   └── 05-normalize-backend-url.envsh  # Normalisasi BACKEND_URL sebelum envsubst
│   ├── index.html
│   ├── vite.config.ts              # Dev server (port 3000, proxy /api), build ke dist/
│   ├── tailwind.config.js / postcss.config.js / tsconfig.json
│   ├── Dockerfile                  # Build Vite -> Nginx alpine, healthcheck /healthz
│   └── package.json / yarn.lock
│
├── tests/tests.txt                 # Skenario uji fungsional (bahasa Inggris)
├── README-COOLIFY.md               # Langkah deploy di Coolify + variabel lingkungan
├── AGENTS.md                       # SOP kerja agent AI (Load by token → kerja → Save via PR)
└── .gitignore
```

---

## 4. Data Flow

### 4.1 Alur request umum (produksi / Coolify)

```
Browser (React SPA)
   │  fetch('/api/...', { credentials: 'include' })      ← src/lib/client.ts
   ▼
Nginx (Frontend-Perkebunan, :80)
   │  location /api/ → proxy_pass ${BACKEND_URL}          ← nginx/default.conf.template
   ▼
Express (Backend-Perkebunan, :3000)                       ← backend/server/index.ts
   │  1. cookie-parser → verifikasi JWT `kebun_session` → req.appUser
   │  2. router(routes)  → handler[] per 'METHOD /api/path'   ← backend/backend/index.ts
   │       requireAuth() → workspaceContext(user) → cek peran → validasi body
   ▼
localSdk.db  (list / get / add / update / delete)          ← backend/backend/localSdk.ts
   │  SQL parametrik ke tabel app_records (table_name = '<entity>:<workspaceId>')
   ▼
MariaDB  ── VIEW v_* ──▶ phpMyAdmin (baca/analisa data)
```

Respons handler berupa `json(body, status)` / `error(message, status)` → dikirim sebagai JSON. Frontend mengubah kode HTTP non-2xx menjadi pesan ramah berbahasa Indonesia (`friendlyHttpError`).

### 4.2 Login & sesi

```
POST /api/auth/login {email, password}
  → bandingkan (timing-safe) dengan ADMIN_EMAIL/ADMIN_PASSWORD
  → userId = sha256(email)[:32]  (atau ADMIN_USER_ID)
  → Set-Cookie: kebun_session=<JWT 12 jam>; HttpOnly; SameSite=Lax|None; Secure
GET  /api/bootstrap → membuat/memuat workspace default user, membership, profil, dan semua master + transaksi awal
POST /api/workspace/switch → ganti perusahaan aktif (disimpan di workspace_profile)
```

### 4.3 Bukti transaksi (upload & tampil)

```
Form Kas & Bank → file dibaca sebagai base64 → POST /api/transactions {receiptBase64, receiptContentType}
  → writeReceipt() (maks ±3 MB) → storage.write() → PutObject ke R2 (key: perkebunan/receipts/<ws>/<no>.<ext>)
  → receiptPath disimpan di record transaksi
Klik "Bukti" → GET /api/transactions/:id/receipt → storage.url() → presigned URL R2 (1 jam) → dibuka di tab baru
```

### 4.4 Contoh alur bisnis: TBS → Piutang → Kas

```
POST /api/tbs            (timbangan lapangan)  → record tbs status LAPANGAN, biaya panen/langsir/armada dihitung
PUT  /api/tbs/:id/factory (timbangan pabrik)   → bruto/tara/potongan → netRevenue, margin, status SELESAI
                                               → armada vendor: supplier_bills otomatis (hutang armada)
POST /api/tbs-payments   (bayar dari PKS)      → alokasi per DO → transaksi Kas/Bank IN (sourceType TBS_PAYMENT)
Payroll: buildPayrollCandidates() menarik panen/timbang/langsir dari tbs + work_entries → payroll_runs → /pay → transaksi OUT
```

### 4.5 Lingkungan preview Emergent (opsional)

```
Browser → Vite dev (:3000, proxy /api) → FastAPI server.py (:8001) → Node Express (:8002, child process) → MariaDB / R2
```

---

## 5. Coding Conventions

### 5.1 Umum
- **Bahasa**: kode & identifier dalam **bahasa Inggris**; teks UI, pesan error API, komentar penjelasan, dan dokumentasi dalam **bahasa Indonesia**.
- **TypeScript strict** (`strict`, `noUnusedLocals`, `noUnusedParameters`). Hindari `any`; gunakan `unknown` + fungsi penyempit (`objectBody`, `text`, `money`, `decimal`).
- Format: indentasi **2 spasi**, **single quote**, **titik koma wajib**, trailing comma pada multiline, lebar baris fleksibel (banyak one-liner di backend agar padat).
- Tidak ada Prettier/ESLint terpasang di repo — ikuti gaya file sekitar. Jangan mereformat file yang tidak diubah.
- Tandai perubahan besar dengan komentar versi ringkas seperti kode lama: `// v84-friendly-api-errors`, `/* v4.15 company deletion */`.

### 5.2 Penamaan
| Hal | Konvensi | Contoh |
|---|---|---|
| File komponen React | `PascalCase.tsx`, satu modul per file | `PayrollModule.tsx`, `TbsFieldEntry.tsx` |
| File util/helper | `camelCase.ts` | `moneyInput.ts`, `navigationState.ts` |
| Variabel, fungsi, properti JSON | `camelCase` | `fieldWeightKg`, `loadWorkRates()` |
| Tipe record entitas | `PascalCase` + akhiran `Record` | `KebunRecord`, `TbsPaymentRecord` |
| Union/enum string | `UPPER_SNAKE` | `'LAPANGAN' \| 'PABRIK' \| 'SELESAI'`, `'IN' \| 'OUT'` |
| Nama entitas tabel logis | `snake_case` | `work_entries`, `inventory_warehouse_balances` |
| Kelas CSS | prefix `farm-` + kebab-case (BEM-like) | `.farm-card`, `.farm-sidebar__item` |
| Kunci localStorage | kebab-case dengan prefix modul | `kebun-active-tab` |
| Variabel lingkungan | `UPPER_SNAKE` | `DATABASE_URL`, `R2_BUCKET` |
| Nomor dokumen | `PREFIX-YYYYMMDD-<acak>` | `TRX-20260920-6053764X1L`, `PAY-...` |

### 5.3 Backend (Express / `backend/backend`)
- Route didefinisikan sebagai objek: `'POST /api/kebun': [requireAuth(), requireOpenAccountingDate('date'), async ctx => { ... }]`. Middleware mengembalikan `LocalResult` untuk menghentikan rantai, `undefined` untuk lanjut.
- Selalu mulai handler dengan `const wc = await workspaceContext(ctx.user!)` lalu **cek peran** (`canManageMaster`, `canTransact`, `canManagePayroll`, `canAccessKebun`).
- Validasi input eksplisit; kembalikan `error('Pesan dalam bahasa Indonesia.', 400|403|404|409)`. Sukses: `json(data)` atau `json({ id, ...record }, 201)`.
- Akses data hanya lewat `db.*` dengan `dataTable(kind, workspaceId)`; **jangan** menulis SQL di `index.ts`. Setiap record menyimpan `createdAt/updatedAt` (ISO string) dan `createdBy/updatedBy` (email aktor).
- Uang dalam **Rupiah bulat** (`money()` → integer), berat/qty desimal (`decimal()`), tanggal `YYYY-MM-DD` divalidasi regex.
- Perubahan yang menghasilkan transaksi turunan (pembayaran TBS, payroll, pembelian) menandai `sourceType` + `sourceId` pada transaksi agar terlindung dari edit/hapus generik.
- Hal yang menyentuh DB/storage/infra ditaruh di `localSdk.ts` agar logika bisnis tetap bebas vendor.

### 5.4 Frontend (React)
- Komponen fungsional + hooks; state lokal per modul, data server diambil lewat `api.*` dari `lib/client.ts` (jangan pakai `fetch` langsung) dan dimuat ulang setelah mutasi.
- Form memakai `useState` objek + handler `onChange`; nilai uang lewat `formatMoneyInput()` dan diparsing ke angka saat submit.
- Navigasi: tab utama dipetakan ke path (`tabPathMap`), pilihan submenu disimpan dengan `storeChoice/readStoredChoice` agar bertahan setelah refresh.
- Setiap elemen interaktif penting diberi label bahasa Indonesia yang jelas; tampilkan status *loading*, *kosong*, dan *error* secara eksplisit.
- Styling di `farm.css` (bukan inline) dengan kelas `farm-*`; Tailwind hanya untuk utilitas kecil.

### 5.5 Database & skema
- Tambah entitas baru = tambah `kind` di `dataTable()` **dan** tambahkan VIEW `v_<nama_indonesia>` di `schema.sql` dengan kolom `JSON_VALUE(record, '$.field')`. Skema harus tetap **idempoten** (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE VIEW`).
- Nama kolom VIEW dalam **snake_case bahasa Indonesia** (`nomor_do`, `berat_pabrik_kg`) untuk kemudahan pengguna phpMyAdmin.

### 5.6 Git & PR
- Branch: `feature/<topik>`, `fix/<topik>`, `docs/<topik>`.
- Pesan commit gaya *conventional commits* berbahasa Indonesia: `feat(payroll): ...`, `fix(frontend): ...`, `refactor: ...`, `docs: ...`.
- Deskripsi PR memuat: Masalah/Tujuan, Perubahan, Uji, Tindakan deploy (jika ada). Jangan pernah commit `.env` atau rahasia; gunakan `.env.example`.

---

## Menjalankan secara lokal (tanpa Docker)

```bash
# Backend (port 3001 agar tidak bentrok dengan Vite di 3000)
cd backend && yarn install
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET, ADMIN_*, R2_* (opsional)
PORT=3001 yarn start   # tsx server/index.ts → http://localhost:3001/api/_healthcheck

# Frontend (terminal lain) — dev server di http://localhost:3000, proxy /api ke backend
cd frontend && yarn install
VITE_DEV_BACKEND=http://localhost:3001 yarn dev

# Data contoh
cd backend && API_BASE=http://localhost:3001 node scripts/seed-dummy.mjs
```

Login default sesuai `ADMIN_EMAIL` / `ADMIN_PASSWORD` di `.env`.
