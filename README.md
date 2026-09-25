# Ecomesta

Multi-tenant SaaS eCommerce platform. Merchants create and operate online stores; the platform provides product, inventory, customer, order, payment, shipping, theme, domain, analytics, and subscription capabilities.

This repository currently includes the **platform foundation through Phase 6**: monorepo, NestJS API (auth, tenancy, catalog, customers), merchant dashboard shell with customer UI, Prisma multi-tenant schema, Redis, and documentation. Orders/checkout/payments remain deferred.

## Requirements

- Node.js **≥ 20**
- pnpm **≥ 9**
- **Docker Desktop** (required for PostgreSQL and Redis via `docker compose`)
- Git

> Local verification of database, Redis, and `GET /api/v1/health` requires Docker. Without it, apps still typecheck, lint, and build, but the API cannot start.

## Installation

```bash
# clone / open the repository
cd Ecomesta

# install dependencies
pnpm install

# copy environment template
cp .env.example .env
```

## Environment setup

1. Copy `.env.example` to `.env` at the repository root.
2. Replace placeholder JWT secrets before any non-local use.
3. Adjust URLs/ports if they conflict with other local services.
4. Never commit `.env` or real credentials.

Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Auth signing secrets |
| `API_URL` / `WEB_URL` / `MERCHANT_URL` / `ADMIN_URL` | App base URLs |
| `S3_*` | Object storage configuration |
| `CORS_ORIGINS` | Allowed browser origins for the API |

The NestJS API also loads `../../.env` from `apps/api`, so a single root `.env` is enough.

## Database setup

### Option A — Docker (when Docker Desktop is available)

```bash
pnpm docker:up
pnpm db:generate
pnpm --filter @ecomesta/api exec dotenv -e ../../.env -- prisma migrate deploy
```

### Option B — Local PostgreSQL 16 (Windows)

1. Create role and database (as a PostgreSQL superuser):

```sql
CREATE ROLE ecomesta LOGIN PASSWORD 'your-secure-local-password';
CREATE DATABASE ecomesta OWNER ecomesta;
\c ecomesta
GRANT ALL ON SCHEMA public TO ecomesta;
ALTER SCHEMA public OWNER TO ecomesta;
```

2. Set `DATABASE_URL` in root `.env` (never commit this file):

```env
DATABASE_URL=postgresql://ecomesta:your-secure-local-password@localhost:5432/ecomesta?schema=public
```

3. Apply migrations:

```bash
pnpm db:generate
pnpm --filter @ecomesta/api exec dotenv -e ../../.env -- prisma migrate deploy
```

### Seed data

```bash
# set SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD in .env first
pnpm db:seed
```

## Running the development environment

```bash
# infrastructure
pnpm docker:up

# API only
pnpm dev:api

# frontends
pnpm dev:web
pnpm dev:merchant
pnpm dev:admin

# or all apps in parallel
pnpm dev
```

Verify API health:

```bash
curl http://localhost:3001/api/v1/health
```

## Available applications

| App | Package | Default URL | Role |
| --- | --- | --- | --- |
| API | `@ecomesta/api` | http://localhost:3001 | NestJS backend (`/api/v1`) |
| Web | `@ecomesta/web` | http://localhost:3000 | Public storefront |
| Merchant | `@ecomesta/merchant` | http://localhost:3002 | Merchant dashboard |
| Admin | `@ecomesta/admin` | http://localhost:3003 | Super Admin dashboard |

Shared packages: `@ecomesta/ui`, `@ecomesta/config`, `@ecomesta/types`, `@ecomesta/utils`.

## Basic commands

```bash
pnpm install          # install workspace deps
pnpm build            # build packages + apps
pnpm typecheck        # TypeScript across workspace
pnpm lint             # lint across workspace
pnpm docker:up        # start Postgres + Redis
pnpm docker:down      # stop infrastructure
pnpm db:generate      # prisma generate
pnpm db:migrate       # prisma migrate (via API package)
pnpm db:studio        # Prisma Studio
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Authentication](docs/auth.md)
- [Tenancy](docs/tenancy.md)
- [Catalog](docs/catalog.md)
- [Customers](docs/customers.md)
- [Merchant dashboard](docs/merchant-dashboard.md)

## License

Proprietary — all rights reserved.
