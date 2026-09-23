#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then echo "Pemakaian: ./scripts/restore.sh backups/file.dump"; exit 1; fi
cat "$1" | docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
