# Deployment Administrasi Perkebunan

Produksi berjalan di VPS SumoPod dan source utama disimpan di repository ini.

Alur deployment saat ini:

1. Perubahan source di-push ke branch `main`.
2. VPS mengecek perubahan secara berkala melalui cron.
3. `scripts/auto-deploy.sh` menjalankan backup, mengambil source terbaru, build Docker, menjalankan container baru, lalu melakukan health check.
4. Jika build atau health check gagal, source dikembalikan ke commit sebelumnya dan aplikasi lama dijalankan kembali.

Catatan keamanan:

- `.env`, `data/`, dan `backups/` tidak masuk Git.
- Deploy key VPS dibatasi ke repository ini.
- Database dan uploads dibackup sebelum deployment.
