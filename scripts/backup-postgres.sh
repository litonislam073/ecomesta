#!/usr/bin/env bash
# Logical Postgres backup (pg_dump, plain SQL, gzip) with retention.
#
# Modes:
#   BACKUP_MODE=direct  (default) — pg_dump on this host using DATABASE_URL or PG* vars.
#   BACKUP_MODE=compose           — pg_dump inside the `postgres` container of
#                                   docker-compose.prod.yml (no DB port needed).
#
# Options (environment):
#   BACKUP_DIR             output directory            (default: ./backups)
#   BACKUP_RETENTION_DAYS  delete older dumps; 0 = keep (default: 14)
#   COMPOSE_FILE           compose file for compose mode (default: docker-compose.prod.yml)
#   ENV_FILE               env file for compose mode    (default: .env.production)
#
# Prints the final dump path as the last line of stdout so it can be chained
# into an off-host copy (see docs/deployment.md §12). Exits non-zero on any
# failure and never leaves a partial dump behind. No credentials are embedded.
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${BACKUP_MODE:-direct}"
OUT_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/ecomesta-postgres-${STAMP}.sql.gz"
TMP_FILE="${OUT_FILE}.partial"

log() { echo "[backup $(date -u +%H:%M:%SZ)] $*" >&2; }
cleanup() { rm -f "$TMP_FILE"; }
trap cleanup EXIT
trap 'log "FAILED (line $LINENO)"; exit 1' ERR

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  log "BACKUP_RETENTION_DAYS must be a non-negative integer"
  exit 1
fi

mkdir -p "$OUT_DIR"
log "mode=$MODE → $OUT_FILE"

case "$MODE" in
  direct)
    if [[ -z "${DATABASE_URL:-}" && -z "${PGHOST:-}" ]]; then
      log "Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE"
      exit 1
    fi
    if [[ -n "${DATABASE_URL:-}" ]]; then
      # libpq rejects Prisma's ?schema= parameter.
      DUMP_URL="${DATABASE_URL%%\?*}"
      pg_dump --no-owner --no-privileges --format=plain "$DUMP_URL" | gzip -c >"$TMP_FILE"
    else
      pg_dump --no-owner --no-privileges --format=plain | gzip -c >"$TMP_FILE"
    fi
    ;;
  compose)
    if [[ ! -f "$ENV_FILE" ]]; then
      log "ENV_FILE not found: $ENV_FILE"
      exit 1
    fi
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
      sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --format=plain' \
      | gzip -c >"$TMP_FILE"
    ;;
  *)
    log "Unknown BACKUP_MODE: $MODE (use direct or compose)"
    exit 1
    ;;
esac

gunzip -t "$TMP_FILE"
# Early exit of grep would SIGPIPE gunzip; judge only grep's result here.
if ! (set +o pipefail; gunzip -c "$TMP_FILE" | head -c 65536 | grep -q "PostgreSQL database dump"); then
  log "Dump does not look like pg_dump output"
  exit 1
fi
mv "$TMP_FILE" "$OUT_FILE"
log "OK $(du -h "$OUT_FILE" | awk '{print $1}')"

if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$OUT_DIR" -maxdepth 1 -type f -name 'ecomesta-postgres-*.sql.gz' \
    -mtime "+$RETENTION_DAYS" -print -delete | while read -r removed; do
    log "retention: removed $(basename "$removed")"
  done
fi

echo "$OUT_FILE"
