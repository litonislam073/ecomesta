#!/usr/bin/env bash
# Renders infrastructure/openlitespeed/ecomesta-vhost.conf.template with the
# current Cloudflare IP ranges and installs it as the Ecomesta OpenLiteSpeed
# vhost (shared-host deployments only). Run as root on the VPS:
#
#   scripts/ols-apply-ecomesta-vhost.sh            # render, diff, install, graceful restart
#   scripts/ols-apply-ecomesta-vhost.sh --check    # render and diff only
#
# Safe to re-run (for example monthly, when Cloudflare publishes new ranges).
# The previous vhost.conf is kept next to it with a timestamp suffix, and the
# script refuses to install when the Cloudflare list looks wrong.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${REPO_DIR}/infrastructure/openlitespeed/ecomesta-vhost.conf.template"
TARGET="${OLS_VHOST_CONF:-/usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf}"
LSWSCTRL="${LSWSCTRL:-/usr/local/lsws/bin/lswsctrl}"
CF_IPS_URL="https://api.cloudflare.com/client/v4/ips"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

log() { printf '[ols-vhost] %s\n' "$*"; }
die() { printf '[ols-vhost] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$TEMPLATE" ]] || die "template not found: $TEMPLATE"
command -v curl >/dev/null || die "curl is required"
command -v python3 >/dev/null || die "python3 is required"

json="$(curl -fsS --max-time 20 "$CF_IPS_URL")" || die "could not download $CF_IPS_URL"

# One CIDR per line, validated strictly; the script aborts on anything odd.
cidrs="$(printf '%s' "$json" | python3 -c '
import ipaddress, json, sys
data = json.load(sys.stdin)
if not data.get("success"):
    sys.exit("Cloudflare API reported failure")
result = data["result"]
v4, v6 = result.get("ipv4_cidrs", []), result.get("ipv6_cidrs", [])
if len(v4) < 10 or len(v6) < 5:
    sys.exit(f"unexpectedly short Cloudflare list: {len(v4)} IPv4, {len(v6)} IPv6")
for cidr in v4 + v6:
    ipaddress.ip_network(cidr, strict=True)
print("\n".join(v4 + v6))
')" || die "Cloudflare IP list failed validation"

allow="$(printf '%s' "$cidrs" | paste -sd, - | sed 's/,/, /g')"
count="$(printf '%s\n' "$cidrs" | wc -l | tr -d ' ')"
log "Cloudflare ranges: ${count}"

placeholders="$(grep -c '@CLOUDFLARE_ALLOW@' "$TEMPLATE" || true)"
[[ "$placeholders" == "1" ]] || die "template must contain @CLOUDFLARE_ALLOW@ exactly once (found ${placeholders})"
grep -qE '^\s*allow\s+@CLOUDFLARE_ALLOW@\s*$' "$TEMPLATE" || die "placeholder must be the accessControl allow value"

rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT
sed "s|@CLOUDFLARE_ALLOW@|${allow}|" "$TEMPLATE" > "$rendered"
grep -q '@CLOUDFLARE_ALLOW@' "$rendered" && die "placeholder was not replaced"
grep -qE '^\s*allow\s+ALL\s*$' "$rendered" && die "refusing to install an allow-ALL vhost"

if [[ -f "$TARGET" ]] && cmp -s "$rendered" "$TARGET"; then
  log "vhost already up to date: $TARGET"
  exit 0
fi

if [[ -f "$TARGET" ]]; then
  diff -u "$TARGET" "$rendered" || true
fi

if [[ "$CHECK_ONLY" == "1" ]]; then
  log "--check: not installing"
  exit 0
fi

[[ "$(id -u)" == "0" ]] || die "run as root to install"
if [[ -f "$TARGET" ]]; then
  backup="${TARGET}.$(date -u +%Y%m%dT%H%M%SZ).bak"
  cp -p "$TARGET" "$backup"
  log "previous vhost saved as $backup"
fi
install -m 0750 -o lsadm -g nogroup "$rendered" "$TARGET"
log "installed $TARGET; gracefully restarting OpenLiteSpeed"
"$LSWSCTRL" restart
log "done. Verify with the curl checks in docs/deployment.md (Shared host → Origin lock-down)."
