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
#   BACKUP_KEEP_MIN        newest dumps retention never deletes (default: 3)
#   BACKUP_MIN_FREE_MB     refuse to start below this free space (default: 1024);
#                          also requires 3× the previous dump size
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

KEEP_MIN="${BACKUP_KEEP_MIN:-3}"
MIN_FREE_MB="${BACKUP_MIN_FREE_MB:-1024}"

for setting in RETENTION_DAYS KEEP_MIN MIN_FREE_MB; do
  if ! [[ "${!setting}" =~ ^[0-9]+$ ]]; then
    log "$setting must be a non-negative integer"
    exit 1
  fi
done
if [[ "$KEEP_MIN" -lt 1 ]]; then
  log "BACKUP_KEEP_MIN must be at least 1"
  exit 1
fi

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR" 2>/dev/null || true

# Newest valid dump first (the UTC timestamp in the name sorts chronologically).
list_dumps() {
  find "$OUT_DIR" -maxdepth 1 -type f -name 'ecomesta-postgres-*.sql.gz' -print | sort -r
}

# Free space: the larger of BACKUP_MIN_FREE_MB and 3× the previous dump.
free_kb="$(df -Pk "$OUT_DIR" | awk 'NR==2 {print $4}')"
need_kb=$((MIN_FREE_MB * 1024))
previous="$(list_dumps | head -n 1)"
if [[ -n "$previous" ]]; then
  previous_kb="$(du -k "$previous" | awk '{print $1}')"
  if [[ $((previous_kb * 3)) -gt "$need_kb" ]]; then
    need_kb=$((previous_kb * 3))
  fi
fi
if [[ -z "$free_kb" || "$free_kb" -lt "$need_kb" ]]; then
  log "insufficient disk space in $OUT_DIR: ${free_kb:-?} KB free, ${need_kb} KB required"
  exit 1
fi

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
chmod 600 "$OUT_FILE"
log "OK $(du -h "$OUT_FILE" | awk '{print $1}')"

# Retention never touches the newest BACKUP_KEEP_MIN dumps, so a run of
# failed backups cannot age out the last good ones.
if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  list_dumps | tail -n +"$((KEEP_MIN + 1))" | while read -r candidate; do
    if [[ -n "$(find "$candidate" -maxdepth 0 -mtime "+$RETENTION_DAYS" -print)" ]]; then
      rm -f -- "$candidate"
      log "retention: removed $(basename "$candidate")"
    fi
  done
fi

echo "$OUT_FILE"
