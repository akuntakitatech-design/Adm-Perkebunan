#!/bin/bash
set -e

APP_DIR="/opt/kebun-app/administrasi-perkebunan-v70-vps/02-vps-selfhost"
BACKUP_DIR="$APP_DIR/backups"
STAMP=$(date +"%Y-%m-%d_%H-%M-%S")

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

echo "Backup database..."
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$BACKUP_DIR/database_$STAMP.sql.gz"

echo "Backup uploads..."
docker compose exec -T app \
  tar -czf - -C /data uploads \
  > "$BACKUP_DIR/uploads_$STAMP.tar.gz"

find "$BACKUP_DIR" -type f -mtime +14 -delete

echo "Backup selesai: $STAMP"
