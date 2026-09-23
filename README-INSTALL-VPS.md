# Administrasi Perkebunan — VPS Self-host v70

Sumber: AppDeploy version `1789443616221` (v70).

## Arsitektur awal

- Frontend: React + TypeScript + Vite
- Backend: TypeScript (logika bisnis v70 dipertahankan)
- Runtime API: Node.js + Express
- Database: PostgreSQL 16
- Penyimpanan bukti: volume lokal Docker `/data/uploads`
- Login awal: email/password dari `.env`, session cookie JWT
- Port uji VPS: `8088`

Versi ini memakai **compatibility layer** untuk menggantikan `@appdeploy/client` dan `@appdeploy/sdk`. Tujuannya agar migrasi tidak perlu menulis ulang seluruh logika bisnis sekaligus.

## Instalasi di VPS baru

> Jalankan hanya di VPS baru khusus aplikasi. Jangan jalankan di VPS Zahir Accounting.

1. Upload folder ini ke VPS, misalnya `/opt/kebun-app`.
2. Masuk ke folder aplikasi.
3. Buat `.env` dari contoh:

```bash
cp .env.example .env
nano .env
```

4. Ganti minimal `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan `JWT_SECRET`.
5. Jalankan:

```bash
docker compose up -d --build
```

6. Periksa:

```bash
docker compose ps
docker compose logs --tail=100 app
```

7. Uji dari browser:

```text
http://IP-VPS:8088
```

## Setelah aplikasi uji berhasil

Jangan langsung memindahkan domain produksi. Tahap berikutnya adalah:

1. migrasi database AppDeploy;
2. migrasi file bukti transaksi;
3. rekonsiliasi saldo Kas/Bank, TBS, hutang/piutang, stok, payroll, aset, neraca saldo;
4. pengujian role/user;
5. baru arahkan `kebun.akuntakita.com` ke VPS dan aktifkan HTTPS.

## Backup

```bash
set -a
. ./.env
set +a
./scripts/backup.sh
```

Backup database dan upload dibuat di folder `backups/`.

## Catatan keamanan

- Jangan commit `.env` ke Git.
- Setelah domain + HTTPS aktif, ubah `COOKIE_SECURE=true`.
- Gunakan password database/login dan JWT secret yang berbeda dan kuat.
- Port PostgreSQL tidak dipublikasikan ke internet oleh `docker-compose.yml`.
