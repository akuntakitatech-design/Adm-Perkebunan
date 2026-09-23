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
COOKIE_SECURE=auto        # auto = ikut protokol (https -> Secure); boleh dihapus
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

**Cara menentukan host backend (`BACKEND_URL`):**

1. **Disarankan — Network Alias.** Buka resource Backend-Perkebunan → **Networking** → kolom **Network aliases** → isi `backend-perkebunan` → Save → **Redeploy backend**. Lalu di frontend: `BACKEND_URL=http://backend-perkebunan:3000`. Alias ini stabil walau backend di-redeploy.
2. **Alternatif — Internal hostname.** Di Backend-Perkebunan → *Application details → Internal access* tampil *Internal hostname* berbentuk `<uuid>-<timestamp>` (contoh `hsagxgqxov41zguu6thieqba-073109609681`). Bisa dipakai, **tetapi berubah setiap redeploy** sehingga env frontend harus diperbarui lagi.

> UUID saja (tanpa timestamp) **bukan** nama yang dikenal DNS Docker di Coolify bila *Network aliases* masih "None".

Syarat: kedua resource berada di **project/environment yang sama** (network Docker `coolify` yang sama). **Port mappings** di frontend dikosongkan (cukup *Ports exposes* `80`); backend juga tidak perlu port mapping ke host.

Sejak v70.2, Nginx me-resolve host backend saat request (bukan saat start). Jika backend belum siap/nama salah, frontend tetap hidup dan `/api` membalas **502 JSON** "Server aplikasi belum dapat dihubungi..." lalu pulih otomatis ketika backend tersedia — periksa *Runtime Logs* frontend, baris `[nginx] proxy /api -> ...`.

## 3. Mode alternatif: domain terpisah (tanpa proxy)

Jika backend punya domain sendiri (`https://api-kebun.domain.com`), set di backend:

```
CORS_ORIGIN=https://kebun.domain-anda.com
```
(`COOKIE_SECURE` biarkan `auto`; lewat HTTPS cookie otomatis `Secure`.)

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

## 6. Troubleshooting login

| Gejala | Penyebab | Solusi |
|---|---|---|
| Setelah login muncul **"Sesi login tidak tersedia."** | Cookie sesi tidak tersimpan browser: `COOKIE_SECURE=true` tetapi situs dibuka lewat `http://` | Gunakan HTTPS (domain `https://...` di Coolify) atau set `COOKIE_SECURE=auto`/`false` lalu redeploy backend |
| `/api/...` membalas 502 JSON "Server aplikasi belum dapat dihubungi" | Nginx tidak bisa resolve `BACKEND_URL` | Isi *Network aliases* backend (`backend-perkebunan`) & redeploy backend; cek `BACKEND_URL=http://backend-perkebunan:3000` |
| Cek cepat | – | `GET https://<domain>/api/_system` menampilkan `cookieSecure`, `requestProto`, `storage` |

## 7. Backup

- Database: fitur backup MariaDB bawaan Coolify (schedule ke S3/R2).
- File bukti: sudah di R2. Saat perusahaan dihapus dari aplikasi, backup JSON otomatis
  ditulis ke `perkebunan/workspace-deletions/` di bucket.
