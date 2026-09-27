#!/usr/bin/env bash
# Restore a gzipped pg_dump produced by scripts/backup-postgres.sh.
#
#   RESTORE_DB=<new_db_name>  restore into a NEW database (created here, must not
#                             exist). Non-destructive — use this for restore drills.
#   (unset)                   restore into the configured database itself. The
#                             target must be empty; requires CONFIRM=yes.
#
# Modes (same as backup): BACKUP_MODE=direct (DATABASE_URL / PG*) or compose.
# Stops at the first SQL error (ON_ERROR_STOP) instead of half-restoring.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${BACKUP_MODE:-direct}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
RESTORE_DB="${RESTORE_DB:-}"

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Usage: [RESTORE_DB=name | CONFIRM=yes] $0 path/to/ecomesta-postgres-….sql.gz" >&2
  exit 1
fi

if [[ -n "$RESTORE_DB" && ! "$RESTORE_DB" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
  echo "RESTORE_DB must be a lowercase identifier" >&2
  exit 1
fi

if [[ -z "$RESTORE_DB" && "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing to restore into the configured database without CONFIRM=yes." >&2
  echo "For a non-destructive drill use RESTORE_DB=<new_db_name>." >&2
  exit 1
fi

gunzip -t "$DUMP_FILE"

case "$MODE" in
  direct)
    if [[ -z "${DATABASE_URL:-}" && -z "${PGHOST:-}" ]]; then
      echo "Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE" >&2
      exit 1
    fi
    BASE_URL="${DATABASE_URL:-}"
    BASE_URL="${BASE_URL%%\?*}"
    if [[ -n "$RESTORE_DB" ]]; then
      psql ${BASE_URL:+"$BASE_URL"} -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$RESTORE_DB\""
      if [[ -n "$BASE_URL" ]]; then
        TARGET_URL="${BASE_URL%/*}/$RESTORE_DB"
      else
        export PGDATABASE="$RESTORE_DB"
        TARGET_URL=""
      fi
    else
      TARGET_URL="$BASE_URL"
    fi
    echo "Restoring $DUMP_FILE into ${RESTORE_DB:-the configured database}" >&2
    gunzip -c "$DUMP_FILE" | psql ${TARGET_URL:+"$TARGET_URL"} -v ON_ERROR_STOP=1 -q >/dev/null
    ;;
  compose)
    DC=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
    if [[ -n "$RESTORE_DB" ]]; then
      "${DC[@]}" exec -T postgres sh -c \
        "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -q -c 'CREATE DATABASE \"$RESTORE_DB\"'"
      TARGET_DB_EXPR="$RESTORE_DB"
    else
      # shellcheck disable=SC2016  # expands inside the container
      TARGET_DB_EXPR='$POSTGRES_DB'
    fi
    echo "Restoring $DUMP_FILE into ${RESTORE_DB:-the configured database}" >&2
    gunzip -c "$DUMP_FILE" | "${DC[@]}" exec -T postgres sh -c \
      "psql -U \"\$POSTGRES_USER\" -d \"$TARGET_DB_EXPR\" -v ON_ERROR_STOP=1 -q >/dev/null"
    ;;
  *)
    echo "Unknown BACKUP_MODE: $MODE (use direct or compose)" >&2
    exit 1
    ;;
esac

echo "Restore completed into ${RESTORE_DB:-the configured database}." >&2
