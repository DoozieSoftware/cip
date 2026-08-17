#!/usr/bin/env bash
# Create a recoverable, integrity-checked cPanel release backup.
#
# This script is deliberately read-only with respect to the live application:
# it copies the database, evidence bytes, release files, and configuration to
# a timestamped directory under BACKUP_ROOT. It never deletes old backups.
set -Eeuo pipefail

# cPanel may have an incomplete locale installation. Keep Perl-backed host
# utilities (and the archive metadata they produce) deterministic instead of
# allowing a locale warning to turn the pre-deploy backup into an abort.
export LANG=C
export LC_ALL=C
export LANGUAGE=C

APP_DIR="${APP_DIR:-$HOME/cip}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/cip-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "Missing production environment: $APP_DIR/.env" >&2
  exit 1
fi
for command in mysqldump gzip tar sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required backup command is unavailable: $command" >&2
    exit 1
  }
done

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_ROOT" "$BACKUP_DIR"

env_value() {
  local key="$1" value
  value="$(sed -n -E "s/^${key}=//p" "$APP_DIR/.env" | head -1)"
  value="${value#\"}"; value="${value%\"}"
  printf '%s' "$value"
}

DB_HOST="$(env_value DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(env_value DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="$(env_value DB_DATABASE)"
DB_USERNAME="$(env_value DB_USERNAME)"
DB_PASSWORD="$(env_value DB_PASSWORD)"
if [[ -z "$DB_DATABASE" || -z "$DB_USERNAME" ]]; then
  echo "DB_DATABASE and DB_USERNAME must be configured" >&2
  exit 1
fi

MYSQL_CNF="$(mktemp)"
trap 'rm -f "$MYSQL_CNF"' EXIT
chmod 600 "$MYSQL_CNF"
{
  printf '[client]\n'
  printf 'host=%s\n' "$DB_HOST"
  printf 'port=%s\n' "$DB_PORT"
  printf 'user=%s\n' "$DB_USERNAME"
  printf 'password=%s\n' "$DB_PASSWORD"
} > "$MYSQL_CNF"

mysqldump --defaults-extra-file="$MYSQL_CNF" --single-transaction \
  --routines --triggers --hex-blob "$DB_DATABASE" \
  | gzip -9 > "$BACKUP_DIR/database.sql.gz"
gzip -t "$BACKUP_DIR/database.sql.gz"

# Release code is kept separate from mutable storage and environment. This
# lets rollback restore code without replacing newer uploads or APP_KEY.
tar -C "$APP_DIR" --exclude='./storage' --exclude='./bootstrap/cache' \
  --exclude='./.env' --exclude='./.env.cpanel' -czf "$BACKUP_DIR/release.tar.gz" .

mkdir -p "$APP_DIR/storage/app/media"
tar -C "$APP_DIR/storage/app" -czf "$BACKUP_DIR/evidence-storage.tar.gz" media

cp -p "$APP_DIR/.env" "$BACKUP_DIR/production.env"
[[ -f "$APP_DIR/.env.cpanel" ]] && cp -p "$APP_DIR/.env.cpanel" "$BACKUP_DIR/env-template"

(cd "$BACKUP_DIR" && sha256sum database.sql.gz release.tar.gz evidence-storage.tar.gz production.env > SHA256SUMS)
chmod 600 "$BACKUP_DIR"/*
printf 'Backup created: %s\n' "$BACKUP_DIR"
