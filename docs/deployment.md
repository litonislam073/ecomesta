# Deployment (VPS staging / production)

Single-VPS deployment with Docker Compose: `postgres`, `redis`, `api`, `web`,
`merchant`, `admin` and `nginx` on private networks, with only nginx publishing
ports 80 and 443. Everything below uses the files in this repository:

| File | Purpose |
| --- | --- |
| `docker-compose.prod.yml` | Full stack, private networks, healthchecks, `migrate` / `seed` tools |
| `apps/{api,web,merchant,admin}/Dockerfile` | Multi-stage images (build context = repo root) |
| `.env.production.example` | Every variable, documented; copy to `.env.production` |
| `infrastructure/nginx/templates/default.conf.template` | Edge routing, TLS, headers, limits |
| `infrastructure/nginx/snippets/*.conf` | Proxy headers, TLS, security headers, hidden paths, storefront limits |
| `infrastructure/nginx/custom-domains/` | One server block per verified merchant domain |
| `scripts/deploy-staging.sh` | Validate env → build → backup → migrate → start → health |
| `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh` | Backups with retention; non-destructive restore drills |

Local development is unchanged (`docker-compose.yml` for Postgres/Redis only,
then `pnpm dev`); see the README.

**Status of this runbook.** The configuration, env validation, nginx routing,
security matrix, backup/restore drill and load smoke were exercised locally
with production builds behind the rendered nginx template (see the end of this
file). Docker image builds, the compose stack on a VPS, real DNS, Let's Encrypt
issuance, the firewall and gateway sandboxes have **not** been run yet — treat
every step marked MANUAL as unverified until you have done it on the server.

---

## 1. Prerequisites

- VPS: Ubuntu 22.04/24.04 LTS (or Debian 12), **2 vCPU / 4 GB RAM minimum**
  (Next.js builds need ~2 GB; builds on 2 GB hosts need swap), 40 GB disk.
- Build **on the VPS** (or on a machine with the same CPU architecture). Images
  built on an Apple Silicon laptop are `arm64` and will not run on an `amd64`
  VPS.
- A domain you control, e.g. `example.com` (use `.com.bd` only after reading
  "Known limitations" below).
- SSH access with a sudo user; root login and password SSH disabled.
- Stripe **test** keys and/or an SSLCommerz **sandbox** store for staging.
  Never use live payment credentials in staging.

## 2. Docker install and host preparation (MANUAL)

Install Docker Engine and the Compose v2 plugin from Docker's apt repository
(<https://docs.docker.com/engine/install/ubuntu/>):

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"   # log out and back in
docker compose version
```

Clone the repository (e.g. `/opt/ecomesta`) and create the certificate
directories nginx mounts:

```bash
sudo mkdir -p /opt/ecomesta /var/www/certbot && sudo chown "$USER" /opt/ecomesta
git clone <your-repo-url> /opt/ecomesta && cd /opt/ecomesta
```

### Firewall (MANUAL — not applied by any script)

Only SSH, HTTP and HTTPS should be reachable:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Docker publishes ports through its own iptables chains and **bypasses ufw**.
That is why `docker-compose.prod.yml` publishes nothing except nginx's 80/443:
Postgres (5432) and Redis (6379) sit on the `backend` network, which is
`internal: true`. Confirm from another machine after startup:

```bash
nc -zv <vps-ip> 5432; nc -zv <vps-ip> 6379; nc -zv <vps-ip> 3001   # all must fail
```

Also use your provider's cloud firewall with the same three ports if it has one.

## 3. DNS

Create these records at your DNS provider (`<ip>` = VPS public IPv4; add
matching `AAAA` records only if the VPS has working IPv6):

| Type | Name | Value | Serves |
| --- | --- | --- | --- |
| A | `example.com` | `<ip>` | Marketing site |
| A or CNAME | `www` | `<ip>` / `example.com` | Marketing site |
| A or CNAME | `api` | `<ip>` / `example.com` | API |
| A or CNAME | `merchant` | `<ip>` / `example.com` | Merchant dashboard |
| A or CNAME | `admin` | `<ip>` / `example.com` | Super Admin |
| A | `*` | `<ip>` | Store subdomains `{slug}.example.com` |

Check propagation before requesting certificates (can take minutes to hours;
lower the TTL to 300 beforehand if you are moving an existing domain):

```bash
dig +short example.com api.example.com merchant.example.com admin.example.com some-store.example.com
```

**Merchant custom domains** (per store, done by the merchant at their
registrar; the platform cannot and does not automate this):

1. In the merchant dashboard → Domains → add `shop.merchant.com`. The raw
   verification token is shown once.
2. TXT record `_ecomesta-verification.shop.merchant.com` = that token → Verify.
3. `CNAME shop.merchant.com → example.com` (or an `A` record to `<ip>` for an
   apex domain) → Activate.
4. Platform operator issues the certificate and adds the nginx server block
   (§10 "Custom domain certificates"). Until then HTTPS to that host is refused.

Verification tokens are stored hashed and are never returned by list/get,
public or admin endpoints. See `docs/custom-domains.md`.

## 4. Environment

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Fill in every value; `.env.production.example` documents each variable, its
format and whether it is build-time (`NEXT_PUBLIC_*`, inlined into browser
bundles — public values only) or runtime. Hostnames must follow the nginx
convention derived from `PLATFORM_ROOT_DOMAIN`:

| Variable | Value |
| --- | --- |
| `API_URL` | `https://api.<root>` |
| `WEB_URL` | `https://<root>` (or `https://www.<root>`) |
| `MERCHANT_URL` / `ADMIN_URL` | `https://merchant.<root>` / `https://admin.<root>` |
| `NEXT_PUBLIC_API_URL` | `API_URL` + `/api/v1` |
| `DATABASE_URL` | `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>?schema=public` |
| `REDIS_URL` | `redis://:<REDIS_PASSWORD>@redis:6379` |

Set by compose, not by you: `API_PORT=3001`, `TRUST_PROXY=true`,
`TRUSTED_PROXY_HOPS=1` (API and web — nginx is the single trusted hop), and
`API_INTERNAL_URL=http://api:3001/api/v1` for web (storefront server renders
call the API over the private network).

`S3_*` and `NEXT_PUBLIC_ADMIN_URL` exist in the development `.env.example` but
are not read by any production code path; leave them out.

**Fail-fast validation.** With `NODE_ENV=production` the API refuses to start
(exit 1, message names the variable, never its value) if any of these hold:
placeholder or low-entropy JWT / payment-encryption secrets, identical access
and refresh secrets, a Postgres or Redis URL without a password (or with a
short / well-known one), `http://` or localhost app URLs or CORS origins, a `*`
CORS origin, or a missing / non-public `PLATFORM_ROOT_DOMAIN`.
`scripts/deploy-staging.sh` runs a lighter pre-check before building.

**Transactional email** (API only, see [email.md](./email.md)):

| Variable | Value |
| --- | --- |
| `EMAIL_PROVIDER_MODE` | `smtp` (leave unset/`disabled` until SMTP is ready; `console` is rejected) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Provider server; `587` + `false` (STARTTLS) or `465` + `true` |
| `SMTP_USER` / `SMTP_PASSWORD` | Provider credentials (never `NEXT_PUBLIC_*`) |
| `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` | e.g. `no-reply@<root>` / `Ecomesta` |
| `APP_PUBLIC_URL` | `https://<root>` |
| `SUPPORT_EMAIL` | Inbox that receives merchant support requests |

With `smtp`, the API refuses to start if any of these is missing, the password
is a placeholder, the host is local or `APP_PUBLIC_URL` is not public https.
Configure SPF, DKIM and DMARC for the sender domain. Email delivery runs inside
the existing `api` container; no extra service is needed.

Never commit `.env.production`; it is git-ignored, excluded from Docker build
contexts (`.dockerignore`), and never copied into images.

## 5. Secret generation

Generate every secret on the VPS; do not reuse values between staging and
production:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD, REDIS_PASSWORD (URL-safe hex)
openssl rand -hex 48   # JWT_ACCESS_SECRET
openssl rand -hex 48   # JWT_REFRESH_SECRET (must differ from the access secret)
openssl rand -hex 32   # PAYMENT_SECRETS_ENCRYPTION_KEY (64 hex chars = 32 bytes)
```

- `PAYMENT_SECRETS_ENCRYPTION_KEY` encrypts merchant gateway credentials
  (AES-256-GCM) in the database. **Losing it makes stored gateway credentials
  unreadable; rotating it requires merchants to re-enter them.** Keep a copy in
  your password manager, separate from database backups.
- Stripe / SSLCommerz credentials are **not** environment variables: merchants
  enter them per store in the dashboard (Payments), where they are encrypted.
  For staging use Stripe test keys (`sk_test_…`) and SSLCommerz sandbox
  credentials only.
- `SEED_SUPER_ADMIN_PASSWORD` is only for the first deploy (§6). Pass it on
  the command line rather than storing it in the file.

## 6. Database migration (and first seed)

Migrations run with `prisma migrate deploy` from the API image (the `migrate`
tool service). `scripts/deploy-staging.sh` does this automatically after a
pre-migration backup. Manually:

```bash
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
$DC up -d --wait postgres redis
$DC run --rm migrate
$DC run --rm migrate ./node_modules/.bin/prisma migrate status
```

**Existing databases only — store slug preflight.** Migration
`20260928010000_store_slug_global_unique` replaces the per-tenant store slug
index with a global one. On a database that already has two stores sharing a
slug (in different tenants), `migrate deploy` stops at that migration. Check
first; this query is read-only and must return no rows:

```bash
$DC exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select slug, count(*) from stores group by slug having count(*) > 1"'
```

If it returns rows, rename the extra stores' slugs before migrating. A fresh
staging database has no stores, so this cannot happen on the first deploy.

**First deploy only** — the seed is idempotent (upserts) and creates:

- Bangladesh divisions, districts and upazilas (required for checkout shipping)
- the built-in themes (required for storefront theming)
- the first Super Admin (it refuses passwords shorter than 12 characters)
- a `starter` subscription plan
- a `demo-merchant` tenant and an **ACTIVE** `demo-store` (USD, UTC) owned by
  the Super Admin, publicly reachable at `demo-store.<PLATFORM_ROOT_DOMAIN>`.
  If you don't want it public on staging, deactivate it in Super Admin →
  Stores after seeding.

No other account is created and no password is hard-coded.

```bash
$DC --profile tools build seed
SEED_SUPER_ADMIN_EMAIL=ops@example.com SEED_SUPER_ADMIN_PASSWORD='<long unique password>' \
  $DC run --rm seed
```

Never run `prisma migrate dev`, `migrate reset` or `db push` against staging
or production, and never `docker compose down -v` (it deletes the
`ecomesta_postgres_data` volume). No script in this repo does any of these.

## 7. Build

```bash
IMAGE_TAG=$(git rev-parse --short HEAD) \
  docker compose --env-file .env.production -f docker-compose.prod.yml build api web merchant admin
```

- `NEXT_PUBLIC_*` values are compiled into the web/merchant/admin bundles:
  **changing any of them requires rebuilding** those images. The build fails
  if `NEXT_PUBLIC_API_URL` is missing.
- Images run as uid 1000, contain no `.env` files, no source maps and (API)
  no dev dependencies; Next apps use `output: 'standalone'`.
- Tag images with the git SHA (the deploy script does) so rollback (§15) can
  select an older tag.

## 8. Startup

Recommended: `./scripts/deploy-staging.sh` (see `--help`). It validates the
env file without printing values, checks the certificate exists, asks you to
type the domain, builds, starts Postgres/Redis, backs up (if tables exist),
migrates, starts the apps and nginx with `--wait`, checks health, and appends
the tag to `.deploy/history`.

Manual equivalent:

```bash
export IMAGE_TAG=$(git rev-parse --short HEAD)
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
$DC up -d --wait postgres redis
$DC run --rm migrate
$DC up -d --wait --no-build api web merchant admin nginx
$DC ps
```

Start order is enforced by healthchecks: API waits for Postgres and Redis;
web waits for the API; nginx waits for all apps. nginx will not start until
the certificates referenced in its config exist (§10).

## 9. Nginx

`infrastructure/nginx/templates/default.conf.template` is rendered by the
official nginx image with `PLATFORM_ROOT_DOMAIN` (only that variable is
substituted). Routing:

| Host | Upstream |
| --- | --- |
| `<root>`, `www.<root>` | web (marketing) |
| `api.<root>` | api |
| `merchant.<root>` / `admin.<root>` | merchant / admin (`X-Robots-Tag: noindex`) |
| `*.<root>` | web (store subdomains) |
| `custom-domains/*.conf` | web (verified merchant domains) |
| anything else on 443 | TLS handshake refused / connection closed (444) |
| port 80 | ACME challenge for any host, otherwise 301 → https |

Behaviour worth knowing:

- `snippets/proxy.conf` **overwrites** `Host`, `X-Forwarded-Host`,
  `X-Forwarded-Proto`, `X-Forwarded-Port`, `X-Forwarded-For` and `X-Real-IP`
  with the real connection values and clears `Forwarded`, so clients cannot
  spoof a hostname or IP. The API and web trust exactly one proxy hop.
- Security headers on web/merchant/admin: HSTS (1 year, no
  `includeSubDomains`, no preload — add those only once every subdomain is
  permanently HTTPS), `nosniff`, `SAMEORIGIN`, `Referrer-Policy`,
  `Permissions-Policy`. The API sets its own via helmet.
- `client_max_body_size 2m` (API accepts JSON only; images are URLs), proxy
  read timeout 60 s (90 s on the API for SSLCommerz IPN validation).
- Hidden paths (`/.env`, `/.git`, `node_modules`, `prisma`, `.next/server`,
  Dockerfiles, compose files) return 404. Swagger (`/api/docs`) is disabled in
  production.
- Storefront page views are limited per client IP (`30 r/s`, burst 120;
  `/_next/static/` unlimited). Limits are generous on purpose: Bangladeshi
  mobile carriers put many shoppers behind one CGNAT address. The API keeps its
  own per-IP limit (120/min) for browser calls; storefront server renders reach
  the API directly over the private network and are exempt from it.

Reload after changing snippets or custom-domain files:

```bash
$DC exec nginx nginx -t && $DC exec nginx nginx -s reload
```

## 10. TLS certificates (Certbot) (MANUAL)

Certbot runs on the host and writes to `/etc/letsencrypt`, which nginx mounts
read-only. Install: `sudo snap install --classic certbot` (or
`sudo apt-get install certbot`).

### Platform certificate (first deploy — before nginx starts)

nginx cannot start without `/etc/letsencrypt/live/<root>/fullchain.pem`, so
issue it first. Store subdomains need a wildcard, and **wildcards require the
DNS-01 challenge**:

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  --cert-name example.com \
  -d example.com -d '*.example.com'
```

Certbot prints TXT records to create at `_acme-challenge.example.com`; wait
for them to resolve (`dig +short TXT _acme-challenge.example.com`) before
continuing. `--manual` certificates **cannot renew unattended**. For
unattended renewal use the official Certbot DNS plugin for your DNS provider
if one exists (e.g. `certbot-dns-cloudflare`, `certbot-dns-digitalocean`) with
a scoped API token stored `chmod 600` outside the repository; otherwise put a
calendar reminder ~30 days before expiry and repeat the command.

Alternative without a wildcard (staging only, or while testing): HTTP-01 with
an explicit name list while port 80 is still free (nginx not yet running):

```bash
sudo certbot certonly --standalone --cert-name example.com \
  -d example.com -d www.example.com -d api.example.com \
  -d merchant.example.com -d admin.example.com -d demo-store.example.com
```

Every store subdomain must then be added to the list and the certificate
re-issued, so this does not scale beyond testing.

### Custom domain certificates

After the merchant's DNS points at the VPS (§3) and nginx is running, issue a
certificate per domain through the webroot nginx already serves on port 80:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d shop.merchant.com
sed 's/STORE_DOMAIN/shop.merchant.com/g' \
  infrastructure/nginx/custom-domains/custom-domain.conf.example \
  > infrastructure/nginx/custom-domains/shop.merchant.com.conf
$DC exec nginx nginx -t && $DC exec nginx nginx -s reload
```

Activated domains must also be **Active** in Ecomesta; the app still refuses
hosts that are not ACTIVE even if nginx forwards them. The `*.conf` files are
git-ignored (server-specific). Remove the file and reload when a domain is
disabled or deleted.

### Renewal

Certbot's systemd timer / cron renews automatically (not for `--manual`).
Reload nginx after each renewal with a deploy hook:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-ecomesta-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
cd /opt/ecomesta && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T nginx nginx -s reload
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-ecomesta-nginx.sh
sudo certbot renew --dry-run
```

Verify from outside: `curl -vI https://example.com 2>&1 | grep -E 'subject|expire|HTTP/'`.
Do not consider HTTPS live until this check passes on the real domain.

## 11. Health checks

| Check | Command |
| --- | --- |
| API (external) | `curl -fsS https://api.example.com/api/v1/health` |
| API (internal) | `$DC exec api node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>r.text()).then(console.log)"` |
| Containers | `$DC ps` (all `healthy`) |
| nginx | `$DC exec nginx wget -qO- http://127.0.0.1/nginx-health` |

Health returns `status: ok` only when Postgres and Redis are both up;
otherwise `degraded` with the failed dependency marked `down`. Error details
are logged, never returned, in production. The container healthcheck requires
`ok`, so a Redis outage marks the API container unhealthy. Point an external
uptime monitor at the API health URL and the storefront apex.

## 12. Backups

`scripts/backup-postgres.sh` writes `backups/ecomesta-postgres-<UTC>.sql.gz`
(mode 600, `umask 077`), verifies gzip integrity and the dump header, never
leaves a partial file, and prunes dumps older than `BACKUP_RETENTION_DAYS`
(default 14; only files matching its own name pattern). In compose mode it runs
`pg_dump` inside the Postgres container — no database port needed.

Nightly cron (as the deploy user):

```cron
15 2 * * * cd /opt/ecomesta && BACKUP_MODE=compose BACKUP_RETENTION_DAYS=14 ./scripts/backup-postgres.sh >> /var/log/ecomesta-backup.log 2>&1
```

**Off-host copy is required** — a backup on the same disk does not survive
losing the VPS. The script prints the dump path as its last line, so chain it
into whatever storage you use (e.g. `rclone copy`, `aws s3 cp`, `scp` to
another server), with encryption at rest and restricted credentials. Keep the
`PAYMENT_SECRETS_ENCRYPTION_KEY` separately from the dumps.

| Target | Value with the cron above | How to improve |
| --- | --- | --- |
| RPO (max data loss) | ≤ 24 h | More frequent dumps; WAL archiving / managed PITR |
| RTO (time to restore) | ≈ 1 h for a small DB on a prepared host | Rehearse §13 quarterly; keep a documented new-VPS path |

Retention suggestion: 14 daily on-host, plus 4 weekly and 3 monthly off-host.
Redis is not backed up by this script (it holds cache, rate-limit counters and
short-lived session state only); its AOF volume survives restarts.

## 13. Restore

Always rehearse into a **new** database first (non-destructive):

```bash
BACKUP_MODE=compose RESTORE_DB=ecomesta_restore_drill \
  ./scripts/restore-postgres.sh backups/ecomesta-postgres-<ts>.sql.gz
$DC exec postgres sh -c 'psql -U "$POSTGRES_USER" -d ecomesta_restore_drill -c "select count(*) from orders"'
$DC exec postgres sh -c 'dropdb -U "$POSTGRES_USER" ecomesta_restore_drill'
```

Real restore (disaster recovery) into the configured database:

1. `$DC stop api web merchant admin` (keep Postgres running).
2. The target database must be empty. Recreate it (**destroys current data** —
   only when that data is already lost or you have a fresh dump of it):
   `$DC exec postgres sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'`
3. `BACKUP_MODE=compose CONFIRM=yes ./scripts/restore-postgres.sh backups/<dump>.sql.gz`
   (stops at the first SQL error).
4. `$DC run --rm migrate` then `$DC up -d --wait api web merchant admin`.
5. Check health, log in as Super Admin, open a store and a recent order.

The restore script refuses to touch the configured database without
`CONFIRM=yes`.

## 14. Logs

- All containers log to Docker's `json-file` driver, rotated at 10 MB × 5 files
  per container.
- `$DC logs -f --tail=200 api` (or `web`, `nginx`, …).
- The API logs JSON (pino) with `authorization`, `cookie`, `set-cookie`,
  `password` and `refreshToken` redacted. Secrets, payment credentials and
  tokens are never logged; do not raise `LOG_LEVEL` to `debug` in production.
- nginx access logs include the client IP; treat them as personal data.

## 15. Rollback

Every deploy builds images tagged with the git SHA and records it in
`.deploy/history`.

```bash
tail -5 .deploy/history                       # find the previous good tag
./scripts/deploy-staging.sh --tag <previous-tag> --skip-build --skip-migrate
```

Migration compatibility rules (Prisma has no down migrations here):

- Write migrations **expand → contract**: add columns/tables in one release,
  switch code, remove old columns in a later release. Then the previous image
  still runs against the migrated schema and app rollback is safe.
- If a release contained a destructive migration, rolling the app back is not
  enough: restore the pre-migration backup the deploy script took (§13) —
  accepting loss of data written since — or ship a forward fix.
- Never edit or delete an applied migration.

## 16. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| API exits at start with `… must …` | Production env validation; fix the named variable (§4) |
| nginx restarts: `cannot load certificate` | Issue the platform certificate first (§10) |
| `502` from nginx | App container not healthy: `$DC ps`, `$DC logs api` |
| Store subdomain shows 404 page | Store slug not active, or DNS `*` record missing |
| Custom domain: TLS error | No certificate / server block yet (§10) |
| Custom domain: Ecomesta 404 page | Domain not ACTIVE in Ecomesta, or still cached (resolution is cached up to 60 s per web instance) |
| Browser CORS error | Origin not one of `WEB_URL`/`MERCHANT_URL`/`ADMIN_URL`/`CORS_ORIGINS`; rebuild after changing `NEXT_PUBLIC_*` |
| Logged out on every refresh | Refresh cookie needs HTTPS (`Secure`); check the API is reached via `https://api.<root>` |
| Many `429` on login/checkout | Per-IP limits; check nginx passes the real client IP (`X-Forwarded-For`) |
| Wrong architecture (`exec format error`) | Image built on a different CPU architecture; build on the VPS |
| Emails not arriving | Super Admin → Email shows the mode and failure category; see [email.md](./email.md#troubleshooting) |

---

## 17. Shared host (existing web server on 80/443, Cloudflare in front)

Use this when the VPS already serves other sites (for example CyberPanel /
OpenLiteSpeed) so Ecomesta's nginx cannot take ports 80/443.

```
visitor → Cloudflare (proxied, SSL Full strict)
        → host web server :443 (Cloudflare Origin Certificate, Cloudflare IPs only)
        → Ecomesta nginx 127.0.0.1:8480 (plain HTTP)
        → api / web / merchant / admin → postgres / redis (internal network)
```

- `docker-compose.shared-host.yml` publishes nginx on `127.0.0.1:${ECOMESTA_HTTP_PORT:-8480}`
  only and swaps in `infrastructure/nginx/shared-host/`. It sends
  `X-Forwarded-Proto: https` and a single validated client IP
  (`X-Forwarded-For` / `X-Real-IP` / `CF-Connecting-IP` = `$edge_client_ip`).
  The app environment is unchanged (`TRUSTED_PROXY_HOPS=1`).
- The host web server must keep the original `Host` header and append its TCP
  peer to `X-Forwarded-For` (OpenLiteSpeed does).
- **Origin lock-down lives in the Ecomesta nginx (QA-002, live since
  2026-09-29).** Every Ecomesta server block answers **403** unless the *last*
  `X-Forwarded-For` hop — the host web server's real TCP peer — is a Cloudflare
  edge; only then is `CF-Connecting-IP` used as the client IP. Direct-origin
  requests with a forged `CF-Connecting-IP` never reach the apps. The
  `default_server` and `/nginx-health` are not affected. No realip directives
  are used.
- Cloudflare ranges: `infrastructure/nginx/cloudflare/cloudflare-geo.conf`,
  generated by `scripts/nginx-cloudflare-ranges.sh` from
  `https://api.cloudflare.com/client/v4/ips` (validated; keeps the old file on
  any failure; nginx refuses to start if the file is missing). Refresh monthly:
  ```bash
  scripts/nginx-cloudflare-ranges.sh --check      # diff only
  scripts/nginx-cloudflare-ranges.sh && docker exec ecomesta-nginx-1 sh -c 'nginx -t && nginx -s reload'
  ```
  A stale list fails closed: requests from a new Cloudflare edge get 403 until
  the list is refreshed, so watch the nginx 403 rate after Cloudflare changes.
- DNS (Cloudflare, proxied): `@`, `www`, `api`, `merchant`, `admin`, `*` → VPS IP.
  Cloudflare's free Universal SSL covers the apex and `*.<root>`.
- `scripts/deploy-staging.sh` assumes the standalone layout (it checks for a
  Let's Encrypt certificate and publishes 80/443), so use the commands below.

```bash
DC="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.shared-host.yml"
export IMAGE_TAG=<tag>
# Build one image at a time on a busy host (parallel Next builds can exhaust RAM).
for s in api web merchant admin; do $DC build $s; done
$DC --profile tools build seed
$DC up -d --wait postgres redis
$DC run --rm -T migrate </dev/null
$DC up -d --wait --no-build api web merchant admin nginx </dev/null
curl -s http://127.0.0.1:8480/nginx-health                         # ok
curl -s https://api.<root>/api/v1/health                            # through Cloudflare
# A direct `-H "Host: api.<root>" http://127.0.0.1:8480/...` now returns 403 by design (QA-002).
```

`docker compose run` reads stdin; pass `-T` and `</dev/null` when running it
from a script or an SSH heredoc, or it consumes the rest of the script.

OpenLiteSpeed example (`/usr/local/lsws/conf/vhosts/<root>/vhost.conf`): a
`proxy` extprocessor to `127.0.0.1:8480`, `context /` using it, `vhssl` with
the Cloudflare Origin Certificate, `accessControl { allow <Cloudflare ranges>, 127.0.0.1; deny ALL }`,
and a `map <root> <root>, www.<root>, api.<root>, merchant.<root>, admin.<root>, *.<root>`
line in the SSL listeners. Back up `httpd_config.conf` first and apply with
`/usr/local/lsws/bin/lswsctrl restart` (graceful).

Custom merchant domains are not covered by this layout yet: each one needs its
own host web server entry and certificate.

---

## Known limitations

- **Keep all app hosts under one registrable domain** (`api.`, `merchant.`,
  `admin.`, apex — the layout `deploy-staging.sh` enforces). The refresh cookie
  is then `SameSite=Lax`. The API's same-site check is a two-label
  approximation, not a public-suffix parser: `example.com.bd` works, but apps
  spread across two different `.com.bd` domains would be misjudged as
  same-site and refresh would fail (sessions drop; nothing is loosened).
  Cross-site layouts on ordinary TLDs switch to `SameSite=None; Secure`, which
  browsers that block third-party cookies may reject.
- **Custom-domain certificates are manual** per domain (§10); there is no
  on-demand TLS.
- **API outage on store hosts.** If the API is unreachable, uncached store
  hosts fall back to the marketing homepage instead of an "unavailable" page.
  No other store is ever served (`?store=` is ignored on production hosts).
- Real Stripe / SSLCommerz sandbox transactions, Let's Encrypt issuance,
  firewall rules and the compose stack on a VPS have not been executed yet;
  complete the MANUAL steps and the checks below on staging.

## Staging acceptance checklist (run on the VPS)

1. `nc -zv <ip> 5432 6379 3001` from outside all fail; `ufw status` shows 22/80/443.
2. `curl -I http://example.com` → 301 https; `curl -vI https://example.com` → valid certificate.
3. Apex, `www`, a store subdomain, `merchant`, `admin` load; an unknown subdomain shows the 404 page.
4. `https://<store>.example.com/?store=other` redirects without the parameter and still shows `<store>`.
5. Merchant signup → onboarding → product → storefront COD checkout with a Bangladesh address → order visible to merchant; stock decremented.
6. Order tracking works with the checkout email/phone; wrong email → 404.
7. Stripe test card and SSLCommerz sandbox payment end to end (IPN reaches `https://api.example.com`; order PAID only after IPN + validation).
8. Merchant Settings save and reflect on the storefront; Super Admin can view tenants/stores/audit logs; a merchant token gets 403 on `/api/v1/admin/*`.
9. Backup via cron produced a dump; restore drill into a new DB succeeded; off-host copy exists.
10. `certbot renew --dry-run` passes.
