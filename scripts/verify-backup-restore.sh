#!/usr/bin/env bash
# Restore drill: proves a dump is usable, not just present.
#
#   scripts/verify-backup-restore.sh [path/to/ecomesta-postgres-….sql.gz]
#
# Restores the dump (default: newest in BACKUP_DIR) into a throw-away database
# named ecomesta_restore_check_<UTC stamp> via scripts/restore-postgres.sh,
# checks it, then drops that database. The live database is never written.
#
# Checks:
#   - every Prisma migration in apps/api/prisma/migrations is recorded as
#     finished and none failed;
#   - the core tables exist;
#   - prints row counts so they can be compared with production.
#
# Modes and connection settings are the same as the backup script
# (BACKUP_MODE=direct with DATABASE_URL, or BACKUP_MODE=compose).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${BACKUP_MODE:-direct}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
CHECK_DB="ecomesta_restore_check_$(date -u +%Y%m%d%H%M%S)"
CORE_TABLES="users tenants stores tenant_users store_users subscriptions subscription_plans products orders payments domains email_deliveries audit_logs"

log() { echo "[restore-check $(date -u +%H:%M:%SZ)] $*" >&2; }

DUMP="${1:-$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ecomesta-postgres-*.sql.gz' -print | sort -r | head -n 1)}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  log "no dump found (BACKUP_DIR=$BACKUP_DIR)"
  exit 1
fi

# psql against a database by name, in either mode.
run_sql() {
  local db="$1" sql="$2"
  case "$MODE" in
    direct)
      local base="${DATABASE_URL:?Set DATABASE_URL}"
      base="${base%%\?*}"
      psql -d "${base%/*}/$db" -v ON_ERROR_STOP=1 -X -q -t -A -c "$sql"
      ;;
    compose)
      # shellcheck disable=SC2016  # $POSTGRES_USER expands inside the container
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
        sh -c 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -X -q -t -A -c "$2"' sh "$db" "$sql"
      ;;
    *) log "Unknown BACKUP_MODE: $MODE"; exit 1 ;;
  esac
}

# Maintenance connection used only to drop the throw-away database.
admin_db() {
  case "$MODE" in
    direct) local base="${DATABASE_URL%%\?*}"; echo "${base##*/}" ;;
    compose) echo postgres ;;
  esac
}

drop_check_db() {
  # Only ever drops the throw-away database this run created.
  if [[ "$CHECK_DB" =~ ^ecomesta_restore_check_[0-9]{14}$ ]]; then
    run_sql "$(admin_db)" "DROP DATABASE IF EXISTS \"$CHECK_DB\"" >/dev/null 2>&1 &&
      log "dropped $CHECK_DB" || log "WARNING: could not drop $CHECK_DB — remove it manually"
  fi
}
trap drop_check_db EXIT

log "dump: $DUMP ($(du -h "$DUMP" | awk '{print $1}'))"
gunzip -t "$DUMP"
RESTORE_DB="$CHECK_DB" BACKUP_MODE="$MODE" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
  "$ROOT_DIR/scripts/restore-postgres.sh" "$DUMP"

failures=0

expected_migrations="$(find "$ROOT_DIR/apps/api/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
finished="$(run_sql "$CHECK_DB" "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null")"
unfinished="$(run_sql "$CHECK_DB" "select count(*) from _prisma_migrations where finished_at is null or rolled_back_at is not null")"
log "migrations: finished=$finished unfinished=$unfinished expected=$expected_migrations"
if [[ "$finished" != "$expected_migrations" || "$unfinished" != "0" ]]; then
  log "FAIL: migration history does not match this repository"
  failures=$((failures + 1))
fi

for table in $CORE_TABLES; do
  exists="$(run_sql "$CHECK_DB" "select to_regclass('public.$table') is not null")"
  if [[ "$exists" != "t" ]]; then
    log "FAIL: table $table missing"
    failures=$((failures + 1))
    continue
  fi
  log "  $table: $(run_sql "$CHECK_DB" "select count(*) from \"$table\"") rows"
done

if [[ "$failures" -gt 0 ]]; then
  log "RESTORE CHECK FAILED ($failures problem(s))"
  exit 1
fi
log "RESTORE CHECK PASSED"
