#!/usr/bin/env bash
# Scheduled Ecomesta Postgres backup (cron entry point).
#
#   /etc/cron.d/ecomesta-backup  →  scripts/backup-scheduled.sh
#
# 1. Loads settings from BACKUP_CONFIG (default /etc/ecomesta/backup.env,
#    root-only). No credentials live in the crontab or in this script.
# 2. Takes an exclusive lock so runs never overlap.
# 3. Runs scripts/backup-postgres.sh (compressed, verified, 0600, retention
#    that always keeps the newest BACKUP_KEEP_MIN dumps, free-space check).
# 4. Copies the new dump off the host when BACKUP_OFFHOST_METHOD is set:
#      rsync  — BACKUP_OFFHOST_TARGET=user@host:/path, BACKUP_OFFHOST_SSH_KEY
#      restic — RESTIC_REPOSITORY + RESTIC_PASSWORD_FILE (+ provider env vars)
#    Without it the run still succeeds locally but logs
#    "OFF-HOST NOT CONFIGURED" and records that in the status file.
# 5. Writes BACKUP_STATUS_FILE (key=value) for monitoring.
#
# Exit codes: 0 local backup OK (off-host OK or not configured),
#             1 local backup failed, 2 off-host copy failed, 75 already running.
set -uo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_CONFIG="${BACKUP_CONFIG:-/etc/ecomesta/backup.env}"

if [[ -f "$BACKUP_CONFIG" ]]; then
  # The config file is root-owned and 0600; refuse anything looser.
  perms="$(stat -c '%a' "$BACKUP_CONFIG" 2>/dev/null || echo 600)"
  if (( 8#$perms & 8#077 )); then
    echo "backup config $BACKUP_CONFIG must not be group/world accessible (mode $perms)" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$BACKUP_CONFIG"
  set +a
fi

export BACKUP_MODE="${BACKUP_MODE:-compose}"
export BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
export BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
export BACKUP_KEEP_MIN="${BACKUP_KEEP_MIN:-3}"
export BACKUP_MIN_FREE_MB="${BACKUP_MIN_FREE_MB:-1024}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/ecomesta-backup.log}"
STATUS_FILE="${BACKUP_STATUS_FILE:-$BACKUP_DIR/last-run.status}"
LOCK_DIR="${BACKUP_LOCK_DIR:-${TMPDIR:-/tmp}/ecomesta-backup.lock}"
OFFHOST_METHOD="${BACKUP_OFFHOST_METHOD:-}"

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

log() {
  local line
  line="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$line" >>"$LOG_FILE"
  echo "$line" >&2
}

write_status() {
  local tmp="${STATUS_FILE}.tmp"
  {
    echo "finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "local_status=$1"
    echo "offhost_status=$2"
    echo "dump=${3:-}"
  } >"$tmp" && mv "$tmp" "$STATUS_FILE"
}

# --- lock (mkdir is atomic; a stale lock from a dead process is reclaimed) ---
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
    log "SKIPPED: another backup is running (pid $holder)"
    exit 75
  fi
  log "reclaiming stale lock ${LOCK_DIR} (pid ${holder:-unknown})"
  rm -rf "$LOCK_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "SKIPPED: could not acquire lock $LOCK_DIR"
    exit 75
  fi
fi
echo $$ >"$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

log "START mode=$BACKUP_MODE dir=$BACKUP_DIR retention=${BACKUP_RETENTION_DAYS}d keep_min=$BACKUP_KEEP_MIN"

output="$("$ROOT_DIR/scripts/backup-postgres.sh" 2> >(while read -r line; do log "  $line"; done))"
status=$?
dump="$(printf '%s\n' "$output" | tail -n 1)"
if [[ $status -ne 0 || -z "$dump" || ! -f "$dump" ]]; then
  log "FAILED: local backup (exit $status)"
  write_status failed skipped ""
  exit 1
fi
log "local backup OK: $dump ($(du -h "$dump" | awk '{print $1}'))"

case "$OFFHOST_METHOD" in
  "")
    log "WARNING: OFF-HOST NOT CONFIGURED — backup exists only on this server (set BACKUP_OFFHOST_METHOD in $BACKUP_CONFIG)"
    write_status ok not_configured "$dump"
    exit 0
    ;;
  rsync)
    if [[ -z "${BACKUP_OFFHOST_TARGET:-}" || -z "${BACKUP_OFFHOST_SSH_KEY:-}" ]]; then
      log "FAILED: off-host rsync needs BACKUP_OFFHOST_TARGET and BACKUP_OFFHOST_SSH_KEY"
      write_status ok failed "$dump"
      exit 2
    fi
    if rsync -a --chmod=F600 --timeout=300 \
      -e "ssh -i ${BACKUP_OFFHOST_SSH_KEY} -o BatchMode=yes -o StrictHostKeyChecking=yes" \
      "$dump" "${BACKUP_OFFHOST_TARGET%/}/" >>"$LOG_FILE" 2>&1; then
      log "off-host rsync OK → ${BACKUP_OFFHOST_TARGET}"
      write_status ok ok "$dump"
      exit 0
    fi
    log "FAILED: off-host rsync to ${BACKUP_OFFHOST_TARGET}"
    write_status ok failed "$dump"
    exit 2
    ;;
  restic)
    if [[ -z "${RESTIC_REPOSITORY:-}" || -z "${RESTIC_PASSWORD_FILE:-}" ]]; then
      log "FAILED: off-host restic needs RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE"
      write_status ok failed "$dump"
      exit 2
    fi
    if restic backup --tag ecomesta-postgres --host ecomesta "$dump" >>"$LOG_FILE" 2>&1 &&
      restic forget --tag ecomesta-postgres --keep-daily "${BACKUP_OFFHOST_KEEP_DAILY:-14}" \
        --keep-weekly "${BACKUP_OFFHOST_KEEP_WEEKLY:-8}" --keep-monthly "${BACKUP_OFFHOST_KEEP_MONTHLY:-6}" \
        --prune >>"$LOG_FILE" 2>&1; then
      log "off-host restic OK → ${RESTIC_REPOSITORY%%:*}:…"
      write_status ok ok "$dump"
      exit 0
    fi
    log "FAILED: off-host restic backup"
    write_status ok failed "$dump"
    exit 2
    ;;
  *)
    log "FAILED: unknown BACKUP_OFFHOST_METHOD '$OFFHOST_METHOD' (use rsync or restic)"
    write_status ok failed "$dump"
    exit 2
    ;;
esac
