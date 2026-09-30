# Runbook: lock the origin to Cloudflare and redirect HTTP → HTTPS (QA-002, QA-005)

> **⛔ DO NOT RUN — this procedure failed on production on 2026-09-29 and was
> rolled back.** OpenLiteSpeed 1.9 on this host evaluates `accessControl`
> against the *visitor* IP it takes from Cloudflare's header (built-in
> Cloudflare detection; no `useIpInProxyHeader` line exists in the config), not
> against the Cloudflare peer. Allowing only Cloudflare ranges therefore
> returned 403 to every visitor. Step 0's `useIpInProxyHeader` check does not
> detect this. A different approach is needed before QA-002/QA-005 can be
> retried; see the Batch 1 privileged-step report.

**Who runs this:** a VPS operator with root on the production host
(`getindexrocket-vps`, 144.91.111.35). **Not automated.** Nothing here has been
executed on production; the vhost change was only dry-run (`--check`).

**What it changes:**

| File | Change |
|---|---|
| `/usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf` | `accessControl` from `allow ALL` to Cloudflare IPv4 + IPv6 ranges with `deny ALL` (QA-002); adds a rewrite that sends `http://ecomesta.com` and `http://www.ecomesta.com` to `https://` with a 301 (QA-005) |
| `/usr/local/lsws/conf/httpd_config.conf` | One line in `listener Default{}` (port 80): `map ecomesta.com ecomesta.com, www.ecomesta.com` |

Source of truth for the vhost: `infrastructure/openlitespeed/ecomesta-vhost.conf.template`,
rendered by `scripts/ols-apply-ecomesta-vhost.sh`. Both are already copied to
`/opt/ecomesta` on the VPS.

---

## ⚠ Shared-host warnings — read first

1. **OpenLiteSpeed on this VPS serves about 15 other sites** (CyberPanel).
   Step 5 runs `lswsctrl restart`, a *graceful* restart for all of them. Do it
   in a low-traffic window and check the other sites afterwards (step 6).
2. **Back up both config files immediately before editing** (step 1), even
   though an older copy exists in `/root/ecomesta-ols-backup-20260929T204439Z/`.
   Someone may have changed the config since then.
3. **Do not edit `httpd_config.conf` through CyberPanel while this runbook is in
   progress.** CyberPanel rewrites that file.
4. **Do not enable `useIpInProxyHeader` in OLS server settings.** If it is on,
   `accessControl` would judge the (forgeable) forwarded IP instead of the
   Cloudflare peer, and every visitor would be refused or every attacker
   allowed. Step 0 checks it is off.
5. After QA-002 every Ecomesta hostname only works **through Cloudflare
   (orange cloud)**. A DNS record for `*.ecomesta.com` that is set to
   "DNS only" (grey cloud) stops working. Custom merchant domains do not reach
   this server today anyway (QA-030).
6. Payment webhooks (Stripe, SSLCommerz) call `https://api.ecomesta.com`, which
   is proxied by Cloudflare, so they keep working.

---

## Step 0 — pre-checks (read-only)

```bash
sudo -i
C=/usr/local/lsws/conf/httpd_config.conf
V=/usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf

grep -nE 'useIpInProxyHeader' "$C" || echo "useIpInProxyHeader: not set"
```
Expected: `useIpInProxyHeader: not set` (or a value of `0`). **Stop if it is
set to 1, 2 or 3.**

```bash
grep -nE '^\s*allow' "$V"
awk '/^listener Default\{/,/^\}/' "$C" | grep -c ecomesta
/usr/local/lsws/bin/lswsctrl status
```
Expected:
```
  allow                   ALL          # (line number varies)
0                                      # no Ecomesta map on port 80 yet
litespeed is running with PID <pid>.
```

Baseline, run from any machine **outside** the VPS:

```bash
for u in https://ecomesta.com/ https://api.ecomesta.com/api/v1/health https://merchant.ecomesta.com/login \
         https://admin.ecomesta.com/login https://demo-store.ecomesta.com/ \
         https://getindexrocket.com/ https://arova.bd/ https://wallnestbd.com/; do
  printf '%-45s ' "$u"; curl -s -o /dev/null -m 25 -w '%{http_code}\n' "$u"; done
```
Expected: `200` for every line. (On 2026-09-29 `advanceseoacademy.com` was
already failing with `000`; that is not caused by this change.) Keep this
output to compare in step 6.

## Step 1 — back up both files (mandatory)

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
B=/root/ecomesta-ols-preQA002-$TS
install -d -m 700 "$B"
cp -p "$C" "$V" "$B"/
sha256sum "$B"/* "$C" "$V"
echo "BACKUP DIR: $B"
```
Expected: four hashes; each backup hash equals the hash of its live file.
Write down the `BACKUP DIR` path — rollback needs it.

## Step 2 — dry run of the vhost

```bash
/opt/ecomesta/scripts/ols-apply-ecomesta-vhost.sh --check
```
Expected (the 22-range count can change when Cloudflare publishes new ranges):
```
[ols-vhost] Cloudflare ranges: 22
--- /usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf ...
+++ /tmp/tmp.XXXXXXXX ...
...
-  allow                   ALL
+  allow                   173.245.48.0/20, 103.21.244.0/22, ..., 2c0f:f248::/32
+  deny                    ALL
+}
+
+rewrite  {
+  enable                  1
+  rules                   <<<END_rules
+RewriteCond %{HTTPS} !=on
+RewriteCond %{HTTP_HOST} ^(www\.)?ecomesta\.com$ [NC]
+RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
+  END_rules
[ols-vhost] --check: not installing
```
**Stop** if the script prints `ERROR`, if the allow line is anything other than
Cloudflare CIDRs, or if the diff touches `extprocessor`, `context` or `vhssl`
(apart from comment lines at the top).

## Step 3 — add the port-80 map (QA-005)

```bash
grep -q '^listener Default{' "$C" || { echo "listener Default{ not found — STOP"; exit 1; }
awk '/^listener Default\{/,/^\}/' "$C" | grep -q 'map .*ecomesta.com' \
  || sed -i '/^listener Default{/a\  map                     ecomesta.com ecomesta.com, www.ecomesta.com' "$C"
awk '/^listener Default\{/,/^\}/' "$C" | grep -n ecomesta
diff <(grep -v 'map                     ecomesta.com ecomesta.com, www.ecomesta.com$' "$C") "$B/httpd_config.conf" && echo "only the map line differs"
```
Expected:
```
2:  map                     ecomesta.com ecomesta.com, www.ecomesta.com
only the map line differs
```
Do **not** add `api`, `merchant`, `admin` or `*.ecomesta.com` to the port-80
map; this change is limited to the apex and `www`.

## Step 4 — install the vhost and restart gracefully (QA-002)

```bash
/opt/ecomesta/scripts/ols-apply-ecomesta-vhost.sh
```
Expected:
```
[ols-vhost] Cloudflare ranges: 22
... (same diff as step 2) ...
[ols-vhost] previous vhost saved as /usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf.<stamp>.bak
[ols-vhost] installed /usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf; gracefully restarting OpenLiteSpeed
[OK] Send SIGUSR1 to <pid>
[ols-vhost] done. Verify with the curl checks in docs/deployment.md (Shared host → Origin lock-down).
```
(The `lswsctrl` line may be worded slightly differently between OLS versions;
any error from it means go to Rollback.)

```bash
sleep 5
/usr/local/lsws/bin/lswsctrl status
tail -n 50 /usr/local/lsws/logs/error.log | grep -iE 'ecomesta|accessControl|rewrite|\[ERROR\]' || echo "no related errors"
```
Expected: `litespeed is running with PID <pid>.` and `no related errors`.

## Step 5 — verification (from a machine outside the VPS)

**5a. Normal traffic through Cloudflare still works**
```bash
for u in https://ecomesta.com/ https://www.ecomesta.com/ https://api.ecomesta.com/api/v1/health \
         https://merchant.ecomesta.com/login https://admin.ecomesta.com/login https://demo-store.ecomesta.com/; do
  printf '%-45s ' "$u"; curl -s -o /dev/null -m 25 -w '%{http_code}\n' "$u"; done
```
Expected: `200`, `308` (www → apex, unchanged), `200`, `200`, `200`, `200`.

**5b. HTTP → HTTPS keeps path and query (QA-005)**
```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://ecomesta.com/pricing?cycle=yearly&x=1'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://www.ecomesta.com/faq?y=2'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://ecomesta.com/'
```
Expected:
```
301 https://ecomesta.com/pricing?cycle=yearly&x=1
301 https://www.ecomesta.com/faq?y=2
301 https://ecomesta.com/
```
If the query string is missing from the first two lines, go to Rollback — do
not leave a redirect that drops query strings.

**5c. Direct origin access is refused (QA-002)**
```bash
curl -sk -o /dev/null -w '%{http_code}\n' --resolve api.ecomesta.com:443:144.91.111.35 \
  -H 'CF-Connecting-IP: 203.0.113.50' https://api.ecomesta.com/api/v1/health
curl -sk -o /dev/null -w '%{http_code}\n' --resolve ecomesta.com:443:144.91.111.35 https://ecomesta.com/
curl -s  -o /dev/null -w '%{http_code}\n' --resolve ecomesta.com:80:144.91.111.35 http://ecomesta.com/
```
Expected: `403`, `403`, `403`. Before the change the first line returned `200`.

**5d. Forged CF-Connecting-IP no longer controls rate limiting**
Repeat the first command of 5c three times with the same and then a different
forged IP. Expected: every response is `403` and carries no
`x-ratelimit-remaining` header (the request never reaches the application).

**5e. Rate limiting still sees the real visitor through Cloudflare**
```bash
for i in 1 2 3; do curl -s -D - -o /dev/null https://api.ecomesta.com/api/v1/health | grep -i x-ratelimit-remaining; done
```
Expected: the value decreases by one per request (e.g. `119`, `118`, `117`) —
one bucket for your real IP.

**5f. Existing HTTPS is unchanged for other Ecomesta hosts on port 80**
```bash
curl -s -o /dev/null -w '%{http_code}\n' http://api.ecomesta.com/api/v1/health
```
Expected: `404` — the same as before; only the apex and `www` were mapped on
port 80.

## Step 6 — other sites on the host

Re-run the baseline loop from step 0. Expected: the same status codes as the
baseline for every non-Ecomesta site.

---

## Rollback

Use the `BACKUP DIR` from step 1.

```bash
sudo -i
B=/root/ecomesta-ols-preQA002-<TS>          # from step 1
cp -p "$B/httpd_config.conf" /usr/local/lsws/conf/httpd_config.conf
cp -p "$B/vhost.conf"        /usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf
sha256sum "$B"/* /usr/local/lsws/conf/httpd_config.conf /usr/local/lsws/conf/vhosts/ecomesta.com/vhost.conf
/usr/local/lsws/bin/lswsctrl restart
sleep 5; /usr/local/lsws/bin/lswsctrl status
```
Expected: each restored file's hash equals its backup's hash;
`litespeed is running with PID <pid>.` Then re-run the step 0 baseline — every
site should return what it returned before.

The vhost script also leaves `vhost.conf.<stamp>.bak` next to the live file;
it is equivalent to `$B/vhost.conf`.

---

## Keeping it in place

- Re-run `scripts/ols-apply-ecomesta-vhost.sh --check` monthly; install when
  Cloudflare's ranges change.
- Never hand-edit the installed vhost or set it back to `allow ALL`
  (see `docs/deployment.md` §17).
- Cloudflare **Always Use HTTPS** can be enabled later as well; the origin
  redirect stays harmless alongside it.
