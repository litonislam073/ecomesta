#!/usr/bin/env bash
# Idempotent shared-host edge for one merchant custom domain:
#   nginx custom-domains/<host>.conf → OLS vhost + listener maps → TLS → reload
#
#   scripts/provision-custom-domain-shared-host.sh example.com
#   scripts/provision-custom-domain-shared-host.sh example.com --remove
#   scripts/provision-custom-domain-shared-host.sh example.com --check
#
# Run as root on the VPS. Safe to re-run. See docs/custom-domains.md.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_EXAMPLE="${REPO_DIR}/infrastructure/nginx/custom-domains/custom-domain.shared-host.conf.example"
OLS_TEMPLATE="${REPO_DIR}/infrastructure/openlitespeed/custom-domain-vhost.conf.template"
CUSTOM_DIR="${CUSTOM_DOMAINS_DIR:-${REPO_DIR}/infrastructure/nginx/custom-domains}"
OLS_VHOST_ROOT="${OLS_VHOST_ROOT:-/usr/local/lsws/conf/vhosts}"
HTTPD_CONF="${OLS_HTTPD_CONF:-/usr/local/lsws/conf/httpd_config.conf}"
LSWSCTRL="${LSWSCTRL:-/usr/local/lsws/bin/lswsctrl}"
SSL_DIR="${ECOMESTA_SSL_DIR:-/etc/ssl/ecomesta}"
ACME_WEBROOT="${ACME_WEBROOT:-/var/www/ecomesta-acme}"
EDGE_PORT="${ECOMESTA_HTTP_PORT:-8480}"
NGINX_CONTAINER="${ECOMESTA_NGINX_CONTAINER:-ecomesta-nginx-1}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
LE_LIVE="${LE_LIVE_DIR:-/etc/letsencrypt/live}"

ACTION=provision
CHECK_ONLY=0
HOSTNAME=""

usage() {
  cat <<'EOF'
Usage: provision-custom-domain-shared-host.sh <hostname> [--remove|--check]
EOF
}

log() { printf '[domain-edge] %s\n' "$*"; }
die() { printf '[domain-edge] ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove) ACTION=remove; shift ;;
    --check) CHECK_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*)
      die "unknown flag: $1"
      ;;
    *)
      [[ -z "$HOSTNAME" ]] || die "unexpected argument: $1"
      HOSTNAME="$1"
      shift
      ;;
  esac
done

[[ -n "$HOSTNAME" ]] || { usage; exit 1; }

# Lowercase FQDN, no scheme/path/port; reject wildcards and reserved labels.
HOSTNAME="$(printf '%s' "$HOSTNAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
[[ "$HOSTNAME" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
  || die "invalid hostname: $HOSTNAME"
[[ ${#HOSTNAME} -le 253 ]] || die "hostname too long: $HOSTNAME"

SAFE_NAME="${HOSTNAME//./_}"
NGINX_CONF="${CUSTOM_DIR}/${HOSTNAME}.conf"
OLS_VH_DIR="${OLS_VHOST_ROOT}/${HOSTNAME}"
OLS_VH_CONF="${OLS_VH_DIR}/vhost.conf"
CF_KEY="${SSL_DIR}/${SAFE_NAME}.key"
CF_CRT="${SSL_DIR}/${SAFE_NAME}.crt"
SELF_KEY="${SSL_DIR}/${SAFE_NAME}.selfsigned.key"
SELF_CRT="${SSL_DIR}/${SAFE_NAME}.selfsigned.crt"
LE_CERT="${LE_LIVE}/${HOSTNAME}/fullchain.pem"
LE_KEY="${LE_LIVE}/${HOSTNAME}/privkey.pem"

reload_nginx() {
  if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
    docker exec "$NGINX_CONTAINER" nginx -t
    docker exec "$NGINX_CONTAINER" nginx -s reload
    log "nginx reloaded ($NGINX_CONTAINER)"
  else
    log "WARNING: nginx container $NGINX_CONTAINER not running; conf written only"
  fi
}

restart_ols() {
  [[ -x "$LSWSCTRL" ]] || die "lswsctrl not found: $LSWSCTRL"
  "$LSWSCTRL" restart
  log "OpenLiteSpeed restarted"
}

# Ensure map lines exist inside every listener that already maps ecomesta.com.
ensure_ols_maps() {
  local host="$1"
  python3 - "$HTTPD_CONF" "$host" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
host = sys.argv[2]
text = path.read_text()
apex = f"  map                     {host} {host}\n"
www = f"  map                     www.{host} {host}\n"
changed = False

def ensure_in_listener(block: str) -> str:
    global changed
    if f"map                     {host} " in block and f"map                     www.{host} " in block:
        return block
    # Insert after the ecomesta.com map when present, else before the closing brace.
    needle = None
    for line in block.splitlines(True):
        if "map" in line and "ecomesta.com" in line and "*.ecomesta.com" in line:
            needle = line
            break
    insert = ""
    if f"map                     {host} " not in block:
        insert += apex
    if f"map                     www.{host} " not in block:
        insert += www
    if not insert:
        return block
    if needle:
        block = block.replace(needle, needle + insert, 1)
    else:
        block = re.sub(r"\n\}\s*$", "\n" + insert + "}\n", block, count=1)
    changed = True
    return block

# Match listener … { … } blocks (non-greedy via brace depth).
out = []
i = 0
while i < len(text):
    m = re.match(r"(listener\s+[^{]+\{)", text[i:])
    if not m:
        out.append(text[i])
        i += 1
        continue
    start = i
    i += m.end()
    depth = 1
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    block = text[start:i]
    if "map" in block:
        block = ensure_in_listener(block)
    out.append(block)

new = "".join(out)

vh = f"""virtualhost {host} {{
  vhRoot                  /usr/local/lsws/conf/vhosts/{host}/
  configFile              $VH_ROOT/vhost.conf
  allowSymbolLink         1
  enableScript            1
  restrained              1
}}
"""
if f"virtualhost {host} {{" not in new:
    # Place before the first "listener SSL" block so CyberPanel layouts stay readable.
    marker = "listener SSL {"
    if marker in new:
        new = new.replace(marker, vh + "\n" + marker, 1)
    else:
        new = new.rstrip() + "\n\n" + vh
    changed = True

if not changed and new == text:
    print("maps-ok")
    sys.exit(0)
path.write_text(new)
print("maps-updated")
PY
}

remove_ols_maps() {
  local host="$1"
  python3 - "$HTTPD_CONF" "$host" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
host = sys.argv[2]
text = path.read_text()
lines = []
skip_vh = False
vh_depth = 0
changed = False
for line in text.splitlines(True):
    if re.match(rf"virtualhost\s+{re.escape(host)}\s*\{{", line):
        skip_vh = True
        vh_depth = line.count("{") - line.count("}")
        changed = True
        continue
    if skip_vh:
        vh_depth += line.count("{") - line.count("}")
        if vh_depth <= 0:
            skip_vh = False
        continue
    if re.search(rf"map\s+{re.escape(host)}\s+", line) or re.search(rf"map\s+www\.{re.escape(host)}\s+", line):
        changed = True
        continue
    lines.append(line)
if changed:
    path.write_text("".join(lines))
    print("maps-removed")
else:
    print("maps-ok")
PY
}

render_nginx() {
  local tmp changed=0
  tmp="$(mktemp)"
  sed "s/STORE_DOMAIN/${HOSTNAME}/g" "$NGINX_EXAMPLE" > "$tmp"
  if [[ ! -f "$NGINX_CONF" ]] || ! cmp -s "$tmp" "$NGINX_CONF"; then
    mv -f "$tmp" "$NGINX_CONF"
    changed=1
  else
    rm -f "$tmp"
  fi
  printf '%s' "$changed"
}

render_ols_vhost() {
  local key="$1" cert="$2" chain="$3"
  mkdir -p "${OLS_VH_DIR}/html" "${OLS_VH_DIR}/logs"
  local tmp changed=0
  tmp="$(mktemp)"
  sed \
    -e "s|@HOSTNAME@|${HOSTNAME}|g" \
    -e "s|@ECOMESTA_HTTP_PORT@|${EDGE_PORT}|g" \
    -e "s|@SSL_KEY@|${key}|g" \
    -e "s|@SSL_CERT@|${cert}|g" \
    -e "s|@SSL_CERT_CHAIN@|${chain}|g" \
    "$OLS_TEMPLATE" > "$tmp"
  if [[ ! -f "$OLS_VH_CONF" ]] || ! cmp -s "$tmp" "$OLS_VH_CONF"; then
    install -m 0640 -o lsadm -g nogroup "$tmp" "$OLS_VH_CONF"
    changed=1
  fi
  rm -f "$tmp"
  chown -R lsadm:nogroup "$OLS_VH_DIR" 2>/dev/null || true
  printf '%s' "$changed"
}

ensure_self_signed() {
  mkdir -p "$SSL_DIR"
  if [[ -f "$SELF_KEY" && -f "$SELF_CRT" ]]; then
    return 0
  fi
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "$SELF_KEY" -out "$SELF_CRT" \
    -subj "/CN=${HOSTNAME}" \
    -addext "subjectAltName=DNS:${HOSTNAME},DNS:www.${HOSTNAME}" >/dev/null 2>&1
  chmod 600 "$SELF_KEY"
  chmod 644 "$SELF_CRT"
}

pick_tls() {
  # Prefer existing Cloudflare Origin material, then Let's Encrypt, else self-signed.
  if [[ -f "$CF_KEY" && -f "$CF_CRT" ]]; then
    printf '%s\n' "$CF_KEY" "$CF_CRT" "0"
    return
  fi
  if [[ -f "$LE_KEY" && -f "$LE_CERT" ]]; then
    printf '%s\n' "$LE_KEY" "$LE_CERT" "1"
    return
  fi
  ensure_self_signed
  printf '%s\n' "$SELF_KEY" "$SELF_CRT" "0"
}

issue_lets_encrypt() {
  command -v certbot >/dev/null || { log "certbot missing; keeping current cert"; return 1; }
  mkdir -p "$ACME_WEBROOT/.well-known/acme-challenge"
  local email_args=(--register-unsafely-without-email)
  if [[ -n "$CERTBOT_EMAIL" ]]; then
    email_args=(--email "$CERTBOT_EMAIL")
  fi
  local domains=(-d "$HOSTNAME")
  # Only request www when it already resolves (avoids HTTP-01 failure).
  if getent hosts "www.${HOSTNAME}" >/dev/null 2>&1; then
    domains+=(-d "www.${HOSTNAME}")
  fi
  if certbot certonly --webroot -w "$ACME_WEBROOT" "${domains[@]}" \
      --agree-tos --non-interactive --keep-until-expiring "${email_args[@]}" \
      >/tmp/ecomesta-certbot-"${SAFE_NAME}".log 2>&1; then
    log "Let's Encrypt cert ready for ${HOSTNAME}"
    return 0
  fi
  log "WARNING: certbot failed (see /tmp/ecomesta-certbot-${SAFE_NAME}.log); using fallback cert"
  return 1
}

do_remove() {
  [[ "$(id -u)" == "0" ]] || die "run as root"
  rm -f "$NGINX_CONF"
  remove_ols_maps "$HOSTNAME" >/dev/null
  if [[ -d "$OLS_VH_DIR" ]]; then
    rm -rf "$OLS_VH_DIR"
  fi
  if [[ "$CHECK_ONLY" == "1" ]]; then
    log "--check remove: would reload nginx + OLS"
    exit 0
  fi
  reload_nginx
  restart_ols
  log "removed edge for ${HOSTNAME}"
}

do_provision() {
  [[ -f "$NGINX_EXAMPLE" ]] || die "missing $NGINX_EXAMPLE"
  [[ -f "$OLS_TEMPLATE" ]] || die "missing $OLS_TEMPLATE"
  [[ -f "$HTTPD_CONF" ]] || die "missing $HTTPD_CONF"
  [[ "$(id -u)" == "0" ]] || die "run as root"

  mkdir -p "$CUSTOM_DIR" "$SSL_DIR" "$ACME_WEBROOT/.well-known/acme-challenge"

  local nginx_changed ols_changed maps_result need_nginx=0 need_ols=0
  nginx_changed="$(render_nginx)"
  mapfile -t tls < <(pick_tls)
  ols_changed="$(render_ols_vhost "${tls[0]}" "${tls[1]}" "${tls[2]}")"
  maps_result="$(ensure_ols_maps "$HOSTNAME")"
  [[ "$nginx_changed" == "1" ]] && need_nginx=1
  [[ "$ols_changed" == "1" || "$maps_result" == "maps-updated" ]] && need_ols=1

  if [[ "$CHECK_ONLY" == "1" ]]; then
    log "--check: nginx_changed=${nginx_changed} ols_changed=${ols_changed} maps=${maps_result} for ${HOSTNAME}"
    exit 0
  fi

  [[ "$need_nginx" == "1" ]] && reload_nginx
  [[ "$need_ols" == "1" ]] && restart_ols

  # After the HTTP path works through CF, try to upgrade to a public cert.
  if [[ ! -f "$CF_CRT" && ! -f "$LE_CERT" ]]; then
    if issue_lets_encrypt && [[ -f "$LE_KEY" && -f "$LE_CERT" ]]; then
      if [[ "$(render_ols_vhost "$LE_KEY" "$LE_CERT" "1")" == "1" ]]; then
        restart_ols
      fi
    fi
  elif [[ ! -f "$CF_CRT" && -f "$LE_CERT" ]]; then
    # Already have LE; ensure vhost points at it (no-op when unchanged).
    if [[ "$(render_ols_vhost "$LE_KEY" "$LE_CERT" "1")" == "1" ]]; then
      restart_ols
    fi
  fi

  if [[ "$need_nginx$need_ols" == "00" ]]; then
    log "already provisioned ${HOSTNAME}"
  else
    log "provisioned ${HOSTNAME}"
  fi
}

case "$ACTION" in
  remove) do_remove ;;
  *) do_provision ;;
esac
