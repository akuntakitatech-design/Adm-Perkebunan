#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
LOCK_FILE="/tmp/kebun-auto-deploy.lock"
MIGRATION_FAIL_MARKER="$APP_DIR/data/source-migration.failed"
MIGRATION_NODE_IMAGE="node:22-bookworm-slim"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

cd "$APP_DIR"

# Jangan menyentuh source jika ada perubahan lokal yang belum di-commit.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[$(date '+%F %T')] SKIP: ada perubahan lokal yang belum di-commit."
  exit 1
fi

git fetch origin main --quiet
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
REMOTE_CHANGED=0
BACKUP_DONE=0

if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo "[$(date '+%F %T')] Update GitHub ditemukan: $LOCAL_HEAD -> $REMOTE_HEAD"
  if [ -f scripts/backup.sh ]; then
    echo "[$(date '+%F %T')] Menjalankan backup..."
    bash scripts/backup.sh
    BACKUP_DONE=1
  fi
  git merge --ff-only origin/main
  REMOTE_CHANGED=1
fi

# Source migration bersifat idempotent. VPS ini menjalankan Node di Docker,
# sehingga migration dieksekusi memakai image Node dan source host di-mount.
# Marker gagal akan dicoba ulang pada run berikutnya setelah script diperbaiki.
MIGRATION_CHANGED=0
if [ -f "$MIGRATION_FAIL_MARKER" ]; then
  echo "[$(date '+%F %T')] Mengulang SOURCE MIGRATION yang sebelumnya gagal."
  rm -f "$MIGRATION_FAIL_MARKER"
fi

shopt -s nullglob
migrations=(scripts/apply-v*.mjs)
for migration in "${migrations[@]}"; do
  if ! docker run --rm \
    --user "$(id -u):$(id -g)" \
    -v "$APP_DIR:/app" \
    -w /app \
    "$MIGRATION_NODE_IMAGE" \
    node "$migration"; then
    echo "[$(date '+%F %T')] SOURCE MIGRATION GAGAL: $migration"
    git restore --source=HEAD -- src/ backend/ 2>/dev/null || true
    mkdir -p "$(dirname "$MIGRATION_FAIL_MARKER")"
    touch "$MIGRATION_FAIL_MARKER"
    exit 1
  fi
done
shopt -u nullglob

if [ -n "$(git status --porcelain -- src/ backend/)" ]; then
  MIGRATION_CHANGED=1
  echo "[$(date '+%F %T')] Perubahan source dari migration terdeteksi."
fi

if [ "$REMOTE_CHANGED" -eq 0 ] && [ "$MIGRATION_CHANGED" -eq 0 ]; then
  exit 0
fi

if [ "$BACKUP_DONE" -eq 0 ] && [ -f scripts/backup.sh ]; then
  echo "[$(date '+%F %T')] Menjalankan backup sebelum perubahan source..."
  bash scripts/backup.sh
  BACKUP_DONE=1
fi

# Build dulu; container lama tetap berjalan sampai image baru berhasil dibuat.
if ! docker compose build app; then
  echo "[$(date '+%F %T')] BUILD GAGAL. Source migration dikembalikan."
  if [ "$MIGRATION_CHANGED" -eq 1 ]; then
    git restore --source=HEAD -- src/ backend/
    mkdir -p "$(dirname "$MIGRATION_FAIL_MARKER")"
    touch "$MIGRATION_FAIL_MARKER"
  elif [ "$REMOTE_CHANGED" -eq 1 ]; then
    git reset --hard "$LOCAL_HEAD"
  fi
  exit 1
fi

docker compose up -d app

# Health check aplikasi lokal.
if command -v curl >/dev/null 2>&1; then
  HEALTHY=0
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 http://127.0.0.1:8088/ >/dev/null 2>&1; then
      HEALTHY=1
      break
    fi
    sleep 2
  done

  if [ "$HEALTHY" -ne 1 ]; then
    echo "[$(date '+%F %T')] HEALTH CHECK GAGAL. Mengembalikan versi sebelumnya."
    if [ "$MIGRATION_CHANGED" -eq 1 ]; then
      git restore --source=HEAD -- src/ backend/
      mkdir -p "$(dirname "$MIGRATION_FAIL_MARKER")"
      touch "$MIGRATION_FAIL_MARKER"
    else
      git reset --hard "$LOCAL_HEAD"
    fi
    docker compose build app
    docker compose up -d app
    exit 1
  fi
fi

# Setelah build dan health check lolos, source hasil migration menjadi source resmi GitHub.
if [ "$MIGRATION_CHANGED" -eq 1 ]; then
  git add src/ backend/
  git commit -m "Apply validated source migration"
  git push origin main
fi

rm -f "$MIGRATION_FAIL_MARKER"
FINAL_HEAD="$(git rev-parse HEAD)"
echo "[$(date '+%F %T')] DEPLOY BERHASIL: $FINAL_HEAD"
