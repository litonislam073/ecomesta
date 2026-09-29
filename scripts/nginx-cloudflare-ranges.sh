#!/usr/bin/env bash
# Regenerates infrastructure/nginx/cloudflare/cloudflare-geo.conf — the
# Cloudflare edge ranges the shared-host nginx trusts as the last
# X-Forwarded-For hop (QA-002 origin lock-down).
#
#   scripts/nginx-cloudflare-ranges.sh            # regenerate if changed
#   scripts/nginx-cloudflare-ranges.sh --check    # show the diff, write nothing
#
# Fail closed: on any download or validation problem the existing file is left
# untouched and the script exits non-zero. It never writes a partial file, and
# it refuses ranges that are too broad, private or otherwise non-global.
# After a change, apply with:  docker exec ecomesta-nginx-1 sh -c 'nginx -t && nginx -s reload'
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${CLOUDFLARE_GEO_FILE:-$ROOT_DIR/infrastructure/nginx/cloudflare/cloudflare-geo.conf}"
# Overridable only for tests (e.g. a file:// fixture); production uses the API.
SOURCE="${CLOUDFLARE_IPS_URL:-https://api.cloudflare.com/client/v4/ips}"
CHECK=0
[[ "${1:-}" == "--check" ]] && CHECK=1

die() { echo "[cloudflare-ranges] ERROR: $*" >&2; exit 1; }
command -v curl >/dev/null || die "curl is required"
PY="$(command -v python3 || command -v python || true)"
[[ -n "$PY" ]] || die "python3 is required"

json="$(curl -fsS --max-time 20 "$SOURCE")" || die "download failed: $SOURCE (existing file kept)"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
printf '%s' "$json" | "$PY" -c '
import ipaddress, json, sys
data = json.load(sys.stdin)
if not data.get("success"):
    sys.exit("Cloudflare API reported failure")
r = data["result"]
v4, v6 = r.get("ipv4_cidrs", []), r.get("ipv6_cidrs", [])
if len(v4) < 10 or len(v6) < 5:
    sys.exit(f"unexpectedly short list: {len(v4)} IPv4, {len(v6)} IPv6")
nets = []
for cidr in v4 + v6:
    net = ipaddress.ip_network(cidr, strict=True)
    min_prefix = 12 if net.version == 4 else 24
    if net.prefixlen < min_prefix:
        sys.exit(f"range too broad: {cidr}")
    if not net.is_global:
        sys.exit(f"non-global range: {cidr}")
    nets.append(net)
etag = r.get("etag", "-")
print("# Cloudflare edge ranges for nginx geo (QA-002). GENERATED — do not edit.")
print(f"# Source: https://api.cloudflare.com/client/v4/ips  etag={etag}")
print(f"# Regenerate: scripts/nginx-cloudflare-ranges.sh  ({len(v4)} IPv4, {len(v6)} IPv6)")
for net in nets:
    print(f"{net} 1;")
' >"$tmp" || die "Cloudflare list failed validation (existing file kept)"

if [[ -f "$OUT" ]] && cmp -s "$tmp" "$OUT"; then
  echo "[cloudflare-ranges] up to date: $OUT"
  exit 0
fi
[[ -f "$OUT" ]] && diff -u "$OUT" "$tmp" || true
if [[ "$CHECK" == "1" ]]; then
  echo "[cloudflare-ranges] --check: not writing"
  exit 0
fi
mkdir -p "$(dirname "$OUT")"
chmod 644 "$tmp"
mv "$tmp" "$OUT"
trap - EXIT
echo "[cloudflare-ranges] wrote $OUT ($(grep -c ' 1;$' "$OUT") ranges)"
