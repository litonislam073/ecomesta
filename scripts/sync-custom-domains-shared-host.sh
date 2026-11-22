#!/usr/bin/env bash
# Sync ACTIVE custom domains from Postgres onto the shared-host edge
# (nginx + OpenLiteSpeed + TLS). Idempotent; safe from cron / systemd.
#
#   scripts/sync-custom-domains-shared-host.sh
#   scripts/sync-custom-domains-shared-host.sh --remove-stale
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROVISION="${REPO_DIR}/scripts/provision-custom-domain-shared-host.sh"
CUSTOM_DIR="${CUSTOM_DOMAINS_DIR:-${REPO_DIR}/infrastructure/nginx/custom-domains}"
PG_CONTAINER="${ECOMESTA_POSTGRES_CONTAINER:-ecomesta-postgres-1}"
ENV_FILE="${ECOMESTA_ENV_FILE:-${REPO_DIR}/.env.production}"
REMOVE_STALE=0
[[ "${1:-}" == "--remove-stale" ]] && REMOVE_STALE=1

log() { printf '[domain-sync] %s\n' "$*"; }
die() { printf '[domain-sync] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -x "$PROVISION" || -f "$PROVISION" ]] || die "missing $PROVISION"
chmod +x "$PROVISION" 2>/dev/null || true
[[ "$(id -u)" == "0" ]] || die "run as root"
docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER" || die "postgres container $PG_CONTAINER not running"

# shellcheck disable=SC1090
if [[ -f "$ENV_FILE" ]]; then
  # Export only what certbot may need; never print secrets.
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(CERTBOT_EMAIL|SUPPORT_EMAIL|ECOMESTA_HTTP_PORT)=' "$ENV_FILE" | sed 's/\r$//' || true)
  set +a
fi
if [[ -z "${CERTBOT_EMAIL:-}" && -n "${SUPPORT_EMAIL:-}" ]]; then
  export CERTBOT_EMAIL="$SUPPORT_EMAIL"
fi

DB_USER="$(docker exec "$PG_CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo ecomesta)"
DB_NAME="$(docker exec "$PG_CONTAINER" printenv POSTGRES_DB 2>/dev/null || echo ecomesta)"

active="$(docker exec -i "$PG_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -Atc \
  "SELECT hostname FROM domains WHERE type = 'CUSTOM_DOMAIN' AND status = 'ACTIVE' ORDER BY hostname;")"

declare -A want=()
while IFS= read -r host; do
  [[ -z "$host" ]] && continue
  want["$host"]=1
  log "provision $host"
  "$PROVISION" "$host" || log "WARNING: provision failed for $host"
done <<< "$active"

if [[ "$REMOVE_STALE" == "1" ]]; then
  shopt -s nullglob
  for conf in "${CUSTOM_DIR}"/*.conf; do
    base="$(basename "$conf" .conf)"
    [[ "$base" == "00-noop" ]] && continue
    if [[ -z "${want[$base]+x}" ]]; then
      log "remove stale $base"
      "$PROVISION" "$base" --remove || log "WARNING: remove failed for $base"
    fi
  done
fi

log "done ($((${#want[@]})) active custom domain(s))"
