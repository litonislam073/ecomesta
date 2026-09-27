# Ecomesta Architecture

## 1. Overall architecture

Ecomesta is a multi-tenant SaaS eCommerce platform delivered as a **pnpm monorepo**.

| Layer | Technology |
| --- | --- |
| Public storefront | Next.js (App Router) – `apps/web` |
| Merchant dashboard | Next.js (App Router) – `apps/merchant` |
| Super Admin | Next.js (App Router) – `apps/admin` |
| Backend API | NestJS – `apps/api` |
| Database | PostgreSQL + Prisma |
| Cache / queues | Redis (+ BullMQ in later phases) |
| Object storage | S3-compatible |
| Edge / reverse proxy | Nginx |

Shared libraries live under `packages/` (`ui`, `config`, `types`, `utils`).

```
Clients (web / merchant / admin)
        │
        ▼
   Nginx (optional)
        │
        ▼
   NestJS API (/api/v1)
        │
   ┌────┴────┐
   ▼         ▼
PostgreSQL  Redis
   │
   ▼
S3-compatible storage
```

## 2. Applications

### `apps/web`
Customer-facing storefront. Resolves store context from domain/subdomain and renders the merchant’s public catalog and checkout.

### `apps/merchant`
Authenticated merchant workspace for products, inventory, orders, customers, themes, domains, and billing.

### `apps/admin`
Platform Super Admin console (port **3003**) for users, tenants, stores, subscription plans, subscriptions, and audit history. Gated on `platformRole === 'SUPER_ADMIN'`: a merchant who signs in here sees an access-denied screen and is offered sign-out, never the dashboard. Mirrors the merchant app's API client and UI primitives by copy rather than cross-import, and carries no store selector because every view is platform-wide. See [admin-platform.md](./admin-platform.md).

### `apps/api`
Single NestJS backend exposing versioned REST under `/api/v1`. Controllers stay thin; services own business rules; Prisma owns persistence.

## 3. Backend modules

Planned modules (foundation only in this phase):

| Module | Responsibility |
| --- | --- |
| Auth | JWT access/refresh, login, logout, session rotation |
| Users | User profiles and membership |
| Roles / Permissions | RBAC definitions and enforcement |
| Tenants | Merchant organizations |
| Stores | Store entities under a tenant |
| Categories / Products / Inventory | Store-scoped catalog APIs (Phase 5) + merchant UI (Phase 7) |
| Customers | Store-scoped customer + address APIs (Phase 6) |
| Merchant dashboard | Login, shell, store selector, catalog + customer UI (Phases 6–7) |
| Orders | Store-scoped order APIs + merchant ops + public tracking timeline (Phase 8–13) |
| Public storefront | Store resolution, public catalog, browsing + cart (Phase 9) |
| Public checkout | Guest checkout + confirmation (Phase 10) + BD zones/quote (Phase 20) |
| Shipping | Store shipping methods, zones, calculation, shipments (Phase 11 + 20) |
| Payments | Offline records + TEST + Stripe Checkout + SSLCommerz adapters (Phases 11–12, 18–19); other gateways deferred |
| Coupons | Store-scoped coupon CRUD, validation, checkout apply (Phase 14) |
| Admin platform | Super Admin APIs for stats, users, tenants, stores, plans, subscriptions, audit + console UI (Phase 15) |
| Themes | Theme selection + validated store theme config, draft/publish, public storefront rendering (Phase 16) |
| Domains / Media | Branding & assets |
| Analytics / Notifications | Insights, messaging |

**Current phase:** Phase 19 **SSLCommerz** — merchants configure encrypted SSLCommerz store credentials at `/dashboard/settings/payments`, storefront checkout can redirect to hosted SSLCommerz when `SSL_COMMERZ` is enabled, and payments become `PAID` only after IPN plus the Order Validation API (browser success URLs remain informational). Phase 18 Stripe Checkout, Phase 17 custom domains, Phase 16 theming, Phase 15 admin, Phase 14 coupons, and the Phase 12 payment-provider architecture remain in place. Offline `COD`/`OTHER` and the deterministic `TEST` provider continue to work alongside Stripe and SSLCommerz.

See [storefront-theming.md](./storefront-theming.md), [custom-domains.md](./custom-domains.md), [customers.md](./customers.md), [merchant-dashboard.md](./merchant-dashboard.md), [admin-platform.md](./admin-platform.md), [catalog-dashboard.md](./catalog-dashboard.md), [orders.md](./orders.md), [storefront.md](./storefront.md), [checkout.md](./checkout.md), [shipping.md](./shipping.md), [payments.md](./payments.md), [payment-providers.md](./payment-providers.md), [sslcommerz.md](./sslcommerz.md), and [coupons.md](./coupons.md).

## 4. Database strategy

- PostgreSQL is the system of record.
- Prisma is the only supported ORM.
- Schema evolves via Prisma Migrate.
- **Phase 2** delivers the full multi-tenant relational foundation (identity, tenancy, catalog, inventory, customers, orders, payments, shipping, coupons, media, themes, domains, subscriptions, audit, notifications).
- `HealthProbe` from Phase 1 is retained for connectivity checks.
- Primary keys use UUID (`@default(uuid())`) for domain tables.
- Monetary values use `Decimal(12, 2)`.
- Case-insensitive identifiers (email, slugs, hostnames, coupon codes) use PostgreSQL `CITEXT`.

See [database.md](./database.md) for the full model reference.

### Entity relationship overview

```
User ──< TenantUser >── Tenant ──< Store
User ──< StoreUser  >── Store
Tenant ──< Subscription >── SubscriptionPlan
Store ──< Product ──< ProductVariant
Store ──< Category (self-parent)
Product >── ProductCategory ──< Category
Store ──< InventoryItem / InventoryMovement
Store ──< Customer ──< CustomerAddress
Store ──< Order ──< OrderItem / OrderAddress
Order ──< Payment / Shipment / CouponUsage
Store ──< Coupon / Media / Domain / ShippingMethod / ShippingZone / StoreTheme
Theme ──< StoreTheme
```

### Important indexes & uniques

- `stores(tenant_id, slug)`, `products(store_id, slug)`, `categories(store_id, slug)`
- `orders(store_id, order_number)`, `coupons(store_id, code)`, `domains(hostname)` unique
- Partial uniques for nullable SKUs, inventory rows, and customer email/phone per store
- Query indexes on `store_id`, status, and created_at for high-traffic tables

### Delete / cascade strategy

- Memberships cascade with parent tenant/store/user.
- Orders, payments, shipments, inventory movements, and coupon usages use `RESTRICT` to protect history.
- Order line FKs to products/variants use `SET NULL` so snapshots survive catalog changes.
- Audit log FKs use `SET NULL` so records remain after actor deletion.

## 5. Multi-tenant strategy

**Model:** Shared database, shared schema, **row-level isolation** via `tenantId` / `storeId`.

Rules:

1. A merchant (tenant) may own one or more stores.
2. Every tenant-owned row must carry `tenantId` and, when store-scoped, `storeId`.
3. Backend services must filter by tenant/store from the authenticated context — never from client-supplied IDs alone without authorization checks.
4. Super Admin may query across tenants through explicit platform-scoped services.
5. Merchant users only see stores they are authorized for.
6. No hardcoded tenant IDs in code or config.
7. Frontend filtering is UX only; **enforcement is always server-side**.

Future hardening options: Prisma middleware / client extensions that inject tenant filters, plus integration tests for cross-tenant denial.

## 6. Authentication strategy

- **Access token:** short-lived JWT (default `15m`) via `Authorization: Bearer`.
- **Refresh token:** longer-lived JWT (default `7d`), rotated on use, stored as HttpOnly cookie (`ecomesta_refresh_token`) with optional JSON body for non-browser clients.
- Refresh sessions persist in `auth_sessions` as **SHA-256 hashes only**.
- Passwords use **Argon2id**.
- Payload includes `sub`, `sid` (session id), `typ`, and minimal identity claims — not memberships.
- Memberships are loaded from `tenant_users` / `store_users` when authorization requires them.
- Roles:
  - Platform: `SUPER_ADMIN` (on `User.platformRole`)
  - Tenant: `OWNER`, `ADMIN`, `STAFF` (on `TenantUser`)
  - Store: `STORE_MANAGER`, `STORE_STAFF` (on `StoreUser`)
- Guards: `AccessTokenGuard`, `RolesGuard`; decorator `@Roles(...)`.
- Secrets via `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` environment variables only.

See [auth.md](./auth.md) for endpoint and security details.

## 7. Redis usage

Redis is configured via `REDIS_URL` and used for:

| Use | Phase |
| --- | --- |
| Health / connectivity | Current |
| Session / refresh token denylist | Auth phase |
| Rate limiting | Security phase |
| BullMQ job queues (emails, webhooks, exports) | Notifications / jobs phase |
| Short-lived cache (analytics counters, etc.) | Analytics phase |

Never embed Redis credentials in source.

## 8. File storage strategy

S3-compatible object storage (MinIO locally, AWS S3 or equivalent in production).

- Config via `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`.
- Media module will issue signed upload URLs and store object metadata in PostgreSQL scoped by `tenantId` / `storeId`.
- Private vs public buckets/policies will be defined per asset type (product images public; invoices private).

## 9. Domain strategy

- Platform apps: `WEB_URL`, `MERCHANT_URL`, `ADMIN_URL`.
- Merchant stores: custom domains and/or `{slug}.{PLATFORM_ROOT_DOMAIN}` subdomains (Phase 17).
- `DomainsService` proves ownership with a DNS TXT challenge (`_ecomesta-verification.<host>`), then activates the host for the storefront. See [custom-domains.md](./custom-domains.md).
- Storefront (`apps/web`) middleware calls `GET /api/v1/public/domain/resolve?host=` and sets `ecomesta.storeSlug` / canonical-host cookies; `?store=` remains an override for local multi-tenant work.
- Nginx terminates TLS in production and routes by host/path.

## 10. Deployment architecture

**Local development**

1. `docker compose up -d` → PostgreSQL + Redis.
2. Apps run on the host via pnpm (`dev:api`, `dev:web`, `dev:merchant`, `dev:admin`).
3. Optional Nginx reverse proxy under `infrastructure/nginx`.

**Production (target)**

- API, web, merchant, and admin as separate deployable units (containers or serverless-compatible Node processes).
- Managed PostgreSQL and Redis.
- S3-compatible storage.
- Nginx or cloud load balancer for TLS and routing.
- Horizontal scale of API behind the load balancer; sticky sessions not required when JWTs are used.
- Structured logs (Pino) shipped to the platform log aggregator.
- Health endpoint `GET /api/v1/health` for readiness/liveness probes.

Containerizing every app is optional for local DX; production images can be added when CI/CD is introduced.
