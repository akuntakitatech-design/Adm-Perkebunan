# Deploy Administrasi Perkebunan di Coolify (Monorepo)

Struktur monorepo:

```
/backend   -> API Node.js + Express (TypeScript), Dockerfile
/frontend  -> React + Vite, disajikan Nginx, Dockerfile (proxy /api ke backend)
```

Database: **MariaDB** (resource Coolify) — skema dibuat otomatis saat backend start
(tabel `app_records` + VIEW `v_*` yang terbaca di phpMyAdmin).
Storage bukti transaksi: **Cloudflare R2** (bucket S3-compatible).

---

## 1. Resource `Backend-Payroll` (Application)

| Pengaturan | Nilai |
|---|---|
| Source | repository ini, branch `main` |
| Build Pack | **Dockerfile** |
| Base Directory | `/backend` |
| Dockerfile Location | `/backend/Dockerfile` |
| Port Exposes | `3000` |
| Health check path | `/api/_healthcheck` |

Environment variables (lihat `backend/.env.example`):

```
DATABASE_URL=mysql://mariadb:<password>@<host-internal-mariadb>:3306/default
DB_AUTO_SCHEMA=true
JWT_SECRET=<acak minimal 32 karakter>
ADMIN_EMAIL=admin@kebun.test
ADMIN_PASSWORD=<password login>
ADMIN_NAME=Owner Administrasi Perkebunan
COOKIE_SECURE=true
CORS_ORIGIN=              # kosongkan jika memakai proxy Nginx (satu domain)
R2_ACCOUNT_ID=91392e9c0d2590c87f719589c08abab2
R2_ENDPOINT=https://91392e9c0d2590c87f719589c08abab2.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET=media-admperkebunan
R2_PREFIX=perkebunan
R2_PUBLIC_URL=            # kosongkan -> presigned URL (privat)
```

> `DATABASE_URL` memakai **URL internal** MariaDB dari Coolify
> (contoh `mysql://mariadb:...@bjjtbrsjd5xd5nqgesgyiukg:3306/default`), bukan IP publik.
> Pastikan backend dan MariaDB berada di **network Coolify yang sama** (default: ya, jika satu server/project).

Backend tidak perlu domain publik jika frontend mem-proxy `/api`.

## 2. Resource `Frontend-Payroll` (Application)

| Pengaturan | Nilai |
|---|---|
| Build Pack | **Dockerfile** |
| Base Directory | `/frontend` |
| Dockerfile Location | `/frontend/Dockerfile` |
| Port Exposes | `80` |
| Domain | `https://kebun.domain-anda.com` |

Environment variables:

```
BACKEND_URL=http://<nama-container-backend>:3000
```

Cara mendapatkan `<nama-container-backend>`: buka resource Backend-Payroll → tab
**Advanced/Network** → salin *container name* (atau isi *Network Alias*, misal `backend-payroll`,
lalu gunakan `http://backend-payroll:3000`). Kedua aplikasi harus **Connect to Predefined Network**
atau berada di project/environment yang sama supaya saling terlihat.

## 3. Mode alternatif: domain terpisah (tanpa proxy)

Jika backend punya domain sendiri (`https://api-kebun.domain.com`), set di backend:

```
CORS_ORIGIN=https://kebun.domain-anda.com
COOKIE_SECURE=true
```

Cookie login otomatis memakai `SameSite=None; Secure`. Frontend tetap memanggil path relatif
`/api/...`, jadi Nginx tetap perlu `BACKEND_URL` mengarah ke domain backend (`https://api-kebun.domain.com`).

## 4. Skema database & phpMyAdmin

- Skema ada di `backend/database/schema.sql` dan diterapkan otomatis (idempoten).
- Manual: `cd backend && DATABASE_URL=... node scripts/apply-schema.mjs`
- Di phpMyAdmin buka database `default` → lihat VIEW `v_kebun`, `v_transaksi_kas_bank`, `v_tbs`,
  `v_payroll`, `v_coa`, dll. `v_ringkasan_data` menampilkan jumlah record per entitas.
- Tabel fisik satu-satunya: `app_records` (kolom `record` = JSON, `entity` & `workspace_id` otomatis).

## 5. Data dummy (opsional)

```
cd backend
API_BASE=https://kebun.domain-anda.com ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-dummy.mjs
```

Script ini login lalu mengisi kebun, kas/bank, PKS, armada, pekerja, tarif, pekerjaan kebun,
dan transaksi contoh melalui API (aman dijalankan pada database kosong).

## 6. Backup

- Database: fitur backup MariaDB bawaan Coolify (schedule ke S3/R2).
- File bukti: sudah di R2. Saat perusahaan dihapus dari aplikasi, backup JSON otomatis
  ditulis ke `perkebunan/workspace-deletions/` di bucket.
