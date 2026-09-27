#!/usr/bin/env bash
# Build and (re)deploy the Ecomesta stack from docker-compose.prod.yml on a VPS.
#
#   ./scripts/deploy-staging.sh                    # build current commit, migrate, start
#   ./scripts/deploy-staging.sh --tag <tag> --skip-build --skip-migrate
#                                                  # roll app containers back to an older image
#
# Options:
#   --env-file PATH   env file (default: .env.production)
#   --tag TAG         image tag (default: short git SHA)
#   --skip-build      reuse existing images for --tag
#   --skip-migrate    do not run `prisma migrate deploy`
#   --skip-backup     do not take the pre-migration backup
#   --yes             do not prompt for confirmation
#
# Safety: this script never runs `prisma migrate dev`, `migrate reset`,
# `db push`, `down -v`, or anything else that drops data. Secret values are
# never printed.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"
TAG=""
SKIP_BUILD=0
SKIP_MIGRATE=0
SKIP_BACKUP=0
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Read KEY from the env file without sourcing it (values may contain shell metacharacters).
env_get() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

# ---------------------------------------------------------------------------
step "Preflight"
command -v docker >/dev/null || die "docker is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin is required"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found (copy .env.production.example and fill it in)"
[[ -f "$COMPOSE_FILE" ]] || die "$COMPOSE_FILE not found"

perms="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")"
if [[ "$perms" != "600" && "$perms" != "400" ]]; then
  die "$ENV_FILE must not be readable by other users (chmod 600 $ENV_FILE)"
fi

if [[ -z "$TAG" ]]; then
  TAG="$(git rev-parse --short HEAD 2>/dev/null || true)"
  [[ -n "$TAG" ]] || die "Cannot derive an image tag from git; pass --tag"
  if [[ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]]; then
    TAG="${TAG}-dirty"
  fi
fi
export IMAGE_TAG="$TAG"

# ---------------------------------------------------------------------------
step "Validating $ENV_FILE (values are not printed)"
required=(
  POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL
  REDIS_PASSWORD REDIS_URL
  JWT_ACCESS_SECRET JWT_REFRESH_SECRET PAYMENT_SECRETS_ENCRYPTION_KEY
  API_URL WEB_URL MERCHANT_URL ADMIN_URL PLATFORM_ROOT_DOMAIN
  NEXT_PUBLIC_API_URL NEXT_PUBLIC_WEB_URL NEXT_PUBLIC_MERCHANT_URL
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN NEXT_PUBLIC_SITE_URL
)
problems=()
for key in "${required[@]}"; do
  value="$(env_get "$key")"
  if [[ -z "$value" ]]; then
    problems+=("$key is empty")
  elif grep -qiE 'change[-_]?me|replace[-_]?me|example\.com' <<<"$value"; then
    problems+=("$key still contains a placeholder")
  fi
done

[[ "$(env_get NODE_ENV)" == "production" ]] || problems+=("NODE_ENV must be production")

root="$(env_get PLATFORM_ROOT_DOMAIN)"
if [[ -n "$root" ]]; then
  # nginx routes by these hostnames (infrastructure/nginx/templates).
  [[ "$(env_get API_URL)" == "https://api.$root" ]] || problems+=("API_URL must be https://api.<PLATFORM_ROOT_DOMAIN>")
  [[ "$(env_get MERCHANT_URL)" == "https://merchant.$root" ]] || problems+=("MERCHANT_URL must be https://merchant.<PLATFORM_ROOT_DOMAIN>")
  [[ "$(env_get ADMIN_URL)" == "https://admin.$root" ]] || problems+=("ADMIN_URL must be https://admin.<PLATFORM_ROOT_DOMAIN>")
  web="$(env_get WEB_URL)"
  [[ "$web" == "https://$root" || "$web" == "https://www.$root" ]] || problems+=("WEB_URL must be https://<root> or https://www.<root>")
  [[ "$(env_get NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN)" == "$root" ]] || problems+=("NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN must equal PLATFORM_ROOT_DOMAIN")
fi
[[ "$(env_get NEXT_PUBLIC_API_URL)" == "$(env_get API_URL)/api/v1" ]] || problems+=("NEXT_PUBLIC_API_URL must be API_URL + /api/v1")

db_url="$(env_get DATABASE_URL)"
pg_pass="$(env_get POSTGRES_PASSWORD)"
[[ "$db_url" == *"@postgres:5432/"* ]] || problems+=("DATABASE_URL host must be postgres:5432 (compose service)")
[[ "$db_url" == *":${pg_pass}@"* ]] || problems+=("DATABASE_URL password must match POSTGRES_PASSWORD")
redis_url="$(env_get REDIS_URL)"
redis_pass="$(env_get REDIS_PASSWORD)"
[[ "$redis_url" == "redis://:${redis_pass}@redis:6379"* ]] || problems+=("REDIS_URL must be redis://:<REDIS_PASSWORD>@redis:6379")
[[ "$pg_pass" =~ ^[A-Za-z0-9._~-]+$ ]] || problems+=("POSTGRES_PASSWORD should be URL-safe (use: openssl rand -hex 24)")
[[ "$redis_pass" =~ ^[A-Za-z0-9._~-]+$ ]] || problems+=("REDIS_PASSWORD should be URL-safe (use: openssl rand -hex 24)")

if [[ ${#problems[@]} -gt 0 ]]; then
  printf '  - %s\n' "${problems[@]}" >&2
  die "Fix $ENV_FILE and re-run. (The API performs stricter checks at startup.)"
fi
echo "env OK"

DC=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${DC[@]}" config --quiet || die "docker compose config failed"

cert="/etc/letsencrypt/live/$root/fullchain.pem"
[[ -f "$cert" ]] || die "TLS certificate missing at $cert — issue it first (docs/deployment.md §10); nginx cannot start without it"

# ---------------------------------------------------------------------------
echo
echo "Target domain : $root"
echo "Image tag     : $IMAGE_TAG"
echo "Build         : $([[ $SKIP_BUILD == 1 ]] && echo skip || echo yes)"
echo "Migrate       : $([[ $SKIP_MIGRATE == 1 ]] && echo skip || echo 'prisma migrate deploy')"
if [[ $ASSUME_YES != 1 ]]; then
  read -r -p "Type the target domain to continue: " answer
  [[ "$answer" == "$root" ]] || die "Confirmation did not match; aborting"
fi

# ---------------------------------------------------------------------------
if [[ $SKIP_BUILD != 1 ]]; then
  step "Building images ($IMAGE_TAG)"
  "${DC[@]}" build api web merchant admin
else
  step "Using existing images ($IMAGE_TAG)"
  for svc in api web merchant admin; do
    docker image inspect "ecomesta-$svc:$IMAGE_TAG" >/dev/null 2>&1 || die "image ecomesta-$svc:$IMAGE_TAG not found"
  done
fi

step "Starting postgres + redis"
"${DC[@]}" up -d --wait postgres redis

if [[ $SKIP_MIGRATE != 1 ]]; then
  # shellcheck disable=SC2016  # $POSTGRES_* expand inside the container
  has_tables="$("${DC[@]}" exec -T postgres sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from information_schema.tables where table_schema = '"'"'public'"'"'"')"
  if [[ "${has_tables//[[:space:]]/}" != "0" && $SKIP_BACKUP != 1 ]]; then
    step "Pre-migration backup"
    BACKUP_MODE=compose ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" ./scripts/backup-postgres.sh
  fi
  step "prisma migrate deploy"
  "${DC[@]}" run --rm migrate
fi

step "Starting application containers"
"${DC[@]}" up -d --wait --no-build api web merchant admin nginx

step "Health"
"${DC[@]}" exec -T api node -e \
  "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>r.json()).then(j=>{const d=j.data;console.log('api',d.status,'database',d.services.database.status,'redis',d.services.redis.status);process.exit(d.status==='ok'?0:1)})"
"${DC[@]}" ps

mkdir -p .deploy
printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$IMAGE_TAG" >>.deploy/history
echo
echo "Deployed $IMAGE_TAG. External check: curl -fsS https://api.$root/api/v1/health"
echo "Previous tags: tail .deploy/history"
