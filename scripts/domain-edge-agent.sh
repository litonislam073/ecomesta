#!/usr/bin/env bash
# Drain the API domain-edge queue and keep shared-host custom domains in sync.
# Intended as a long-running systemd service (or a short cron drain).
#
# Queue files (written by the API):
#   /opt/ecomesta/var/domain-edge-queue/<id>.json
#   {"action":"provision"|"remove","hostname":"shop.example.com"}
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROVISION="${REPO_DIR}/scripts/provision-custom-domain-shared-host.sh"
SYNC="${REPO_DIR}/scripts/sync-custom-domains-shared-host.sh"
QUEUE_DIR="${DOMAIN_EDGE_QUEUE_DIR:-${REPO_DIR}/var/domain-edge-queue}"
POLL_SECONDS="${DOMAIN_EDGE_POLL_SECONDS:-2}"
SYNC_EVERY="${DOMAIN_EDGE_SYNC_EVERY:-60}"
ONCE=0
[[ "${1:-}" == "--once" ]] && ONCE=1

log() { printf '[domain-agent] %s\n' "$*"; }
die() { printf '[domain-agent] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" == "0" ]] || die "run as root"
chmod +x "$PROVISION" "$SYNC" 2>/dev/null || true
mkdir -p "$QUEUE_DIR"
chmod 0775 "$QUEUE_DIR"

process_queue() {
  local f action hostname
  shopt -s nullglob
  for f in "$QUEUE_DIR"/*.json; do
    [[ -f "$f" ]] || continue
    action="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("action",""))' "$f" 2>/dev/null || true)"
    hostname="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("hostname",""))' "$f" 2>/dev/null || true)"
    if [[ -z "$action" || -z "$hostname" ]]; then
      log "skip bad queue file $(basename "$f")"
      mv -f "$f" "${f}.bad"
      continue
    fi
    log "$action $hostname (from $(basename "$f"))"
    if [[ "$action" == "remove" ]]; then
      "$PROVISION" "$hostname" --remove || log "WARNING: remove failed for $hostname"
    else
      "$PROVISION" "$hostname" || log "WARNING: provision failed for $hostname"
    fi
    rm -f "$f"
  done
}

last_sync=0
drain() {
  process_queue
  local now
  now="$(date +%s)"
  if (( now - last_sync >= SYNC_EVERY )); then
    "$SYNC" || log "WARNING: sync failed"
    last_sync=$now
  fi
}

if [[ "$ONCE" == "1" ]]; then
  SYNC_EVERY=0
  last_sync=0
  drain
  exit 0
fi

log "watching $QUEUE_DIR (poll=${POLL_SECONDS}s, sync every ${SYNC_EVERY}s)"
while true; do
  drain
  sleep "$POLL_SECONDS"
done
