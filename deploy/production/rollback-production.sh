#!/usr/bin/env bash
# Restore code from a backup created by backup-production.sh.
# Database restore is intentionally opt-in and evidence is never overwritten
# automatically; see docs/production-rollback-runbook.md.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/cip}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/cip-backups}"
BACKUP_DIR="${1:-}"

if [[ "${CONFIRM_ROLLBACK:-}" != "YES" ]]; then
  echo "Set CONFIRM_ROLLBACK=YES to run a rollback." >&2
  exit 1
fi
if [[ -z "$BACKUP_DIR" || "$BACKUP_DIR" != "$BACKUP_ROOT"/* || ! -d "$BACKUP_DIR" ]]; then
  echo "Usage: CONFIRM_ROLLBACK=YES $0 $BACKUP_ROOT/<timestamp>" >&2
  exit 1
fi

(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
for command in tar rsync sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required rollback command is unavailable: $command" >&2
    exit 1
  }
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$APP_DIR/.env" "$APP_DIR/.env.before-rollback-$STAMP"
TEMP_DIR="$(mktemp -d "$APP_DIR/.rollback.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT
tar -xzf "$BACKUP_DIR/release.tar.gz" -C "$TEMP_DIR"

# Keep storage and .env outside the code restore. rsync is scoped to APP_DIR
# and cannot remove evidence or configuration.
rsync -a --delete --exclude='storage/' --exclude='.env' --exclude='.env.*' \
  --exclude='bootstrap/cache/' "$TEMP_DIR/" "$APP_DIR/"

if [[ "${RESTORE_DATABASE:-}" == "YES" ]]; then
  for command in mysql gunzip; do
    command -v "$command" >/dev/null 2>&1 || {
      echo "Required database restore command is unavailable: $command" >&2
      exit 1
    }
  done
  env_value() {
    local key="$1" value
    value="$(sed -n -E "s/^${key}=//p" "$APP_DIR/.env" | head -1)"
    value="${value#\"}"; value="${value%\"}"
    printf '%s' "$value"
  }
  MYSQL_CNF="$(mktemp)"
  trap 'rm -f "$MYSQL_CNF"; rm -rf "$TEMP_DIR"' EXIT
  chmod 600 "$MYSQL_CNF"
  {
    printf '[client]\n'
    printf 'host=%s\n' "$(env_value DB_HOST)"
    printf 'port=%s\n' "$(env_value DB_PORT)"
    printf 'user=%s\n' "$(env_value DB_USERNAME)"
    printf 'password=%s\n' "$(env_value DB_PASSWORD)"
  } > "$MYSQL_CNF"
  gunzip -c "$BACKUP_DIR/database.sql.gz" | mysql --defaults-extra-file="$MYSQL_CNF" "$(env_value DB_DATABASE)"
  rm -f "$MYSQL_CNF"
else
  echo "Code rollback complete; database was not restored (set RESTORE_DATABASE=YES for an explicit restore)."
fi

echo "Evidence archive is preserved at $BACKUP_DIR/evidence-storage.tar.gz and was not extracted."
