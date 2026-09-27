# Super Admin Platform Console (Phase 15)

Next.js App Router app in `apps/admin` (port **3003**). It is the only UI for
platform-wide administration; merchants never see it.

## Architecture

```
Browser
  → Admin UI (Next.js)
  → NEXT_PUBLIC_API_URL (/api/v1)
  → NestJS AccessTokenGuard + RolesGuard('SUPER_ADMIN')
  → AuthorizationService.assertSuperAdmin
  → PostgreSQL
```

The admin app mirrors the merchant app's API client, auth context and UI
primitives rather than importing them, so the two surfaces can diverge without
coupling. Copies live under `apps/admin/src/lib` and
`apps/admin/src/components/ui`.

Configure with `NEXT_PUBLIC_API_URL` (see `.env.example`). `ADMIN_URL`
(`http://localhost:3003`) must stay in `CORS_ORIGINS` for the API to accept
refresh-cookie requests from this origin.

## Super Admin permissions

Every route under `/api/v1/admin/*` is guarded twice:

1. `@UseGuards(AccessTokenGuard, RolesGuard)` with `@Roles('SUPER_ADMIN')`
   rejects the request before it reaches a controller body.
2. Each service re-checks with `AuthorizationService.assertSuperAdmin(userId)`,
   so a bug in guard wiring cannot leak platform data.

The `PlatformRole` enum has exactly two values: `USER` and `SUPER_ADMIN`. There
is no tenant-scoped escalation path into this console — tenant `OWNER` and
`ADMIN` roles grant nothing here.

### Client-side gate

`AuthProvider` exposes `isSuperAdmin` derived from `GET /auth/me`. The gate runs
in two places:

- `AdminShell` (wrapping every `/dashboard/*` route) redirects unauthenticated
  visitors to `/login?next=…`, and renders `AccessDenied` — never the dashboard —
  for an authenticated account whose `platformRole !== 'SUPER_ADMIN'`.
- `/login` renders the same `AccessDenied` if a non-admin session already exists,
  so a merchant who signs in here cannot fall through to the console.

`AccessDenied` offers sign-out as its only action. This is UX defence in depth;
the backend guards remain authoritative.

### Token handling

- Access token lives in React memory only.
- Refresh uses the HttpOnly cookie via `POST /auth/refresh` with
  `credentials: 'include'`.
- Nothing is written to `localStorage` or `sessionStorage`.
- Password hashes and tokens are never selected by the admin API, and audit
  metadata is scrubbed client-side by `redactMetadata` before rendering
  (keys matching `token|password|secret|hash|credential|apikey` show
  `[redacted]`).

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/dashboard`, which bounces to `/login` when signed out |
| `/login` | Super Admin sign in |
| `/dashboard` | Platform counters from `GET /admin/stats` |
| `/dashboard/users` | User list with search, status and platform-role filters |
| `/dashboard/users/[userId]` | Detail, memberships, suspend/activate, platform-role change |
| `/dashboard/tenants` | Tenant list with search and status filter |
| `/dashboard/tenants/[tenantId]` | Stores, members, latest subscription, recent audit, suspend/activate |
| `/dashboard/stores` | Store list across all tenants |
| `/dashboard/stores/[storeId]` | Counts, domains (no verification tokens), members, active theme (read-only), suspend/activate |
| `/dashboard/plans` | Subscription plan list |
| `/dashboard/plans/new` | Create a plan |
| `/dashboard/plans/[planId]` | Edit a plan, activate/deactivate |
| `/dashboard/subscriptions` | Subscription list with status filter |
| `/dashboard/subscriptions/[subscriptionId]` | Detail plus lifecycle status change |
| `/dashboard/audit-logs` | Filterable, paginated audit history |

Navigation sections: Overview (Dashboard), Accounts (Users, Tenants, Stores),
Billing (Plans, Subscriptions), Compliance (Audit Logs). There is deliberately
**no store selector** — the admin shell is always platform-wide.

Every list is paginated at 20 per page against the API's `OffsetPageMeta`.

## API surface

| Method | Path | Body |
| --- | --- | --- |
| GET | `/admin/stats` | — |
| GET | `/admin/users` | query: `search`, `status`, `platformRole`, `sort`, `order`, `page`, `limit` |
| GET | `/admin/users/:userId` | — |
| PATCH | `/admin/users/:userId/status` | `{ status: 'ACTIVE' \| 'SUSPENDED' }` |
| PATCH | `/admin/users/:userId/platform-role` | `{ platformRole: 'USER' \| 'SUPER_ADMIN' }` |
| GET | `/admin/tenants` | query: `search`, `status`, `page`, `limit` |
| GET | `/admin/tenants/:tenantId` | — |
| PATCH | `/admin/tenants/:tenantId/status` | `{ status: 'ACTIVE' \| 'SUSPENDED' }` |
| GET | `/admin/stores` | query: `search`, `status`, `tenantId`, `page`, `limit` |
| GET | `/admin/stores/:storeId` | — (includes `theme: { name, slug, publishedAt } \| null`) |
| PATCH | `/admin/stores/:storeId/status` | `{ status: 'ACTIVE' \| 'SUSPENDED' }` |
| GET | `/admin/plans` | query: `search`, `active`, `page`, `limit` |
| POST | `/admin/plans` | `{ name, slug, description?, monthlyPrice, yearlyPrice, active?, configuration? }` |
| GET | `/admin/plans/:planId` | — |
| PATCH | `/admin/plans/:planId` | partial plan |
| PATCH | `/admin/plans/:planId/status` | `{ active: boolean }` |
| GET | `/admin/subscriptions` | query: `search`, `status`, `tenantId`, `planId`, `page`, `limit` |
| POST | `/admin/subscriptions` | `{ tenantId, planId, billingCycle, status?, startsAt? }` |
| GET | `/admin/subscriptions/:subscriptionId` | — |
| PATCH | `/admin/subscriptions/:subscriptionId/status` | `{ status }` |
| GET | `/admin/audit-logs` | query: `action`, `userId`, `tenantId`, `storeId`, `from`, `to`, `page`, `limit` |

Shared response shapes live in `packages/types` (`AdminStats`, `AdminUser`,
`AdminUserDetail`, `AdminTenantListItem`, `AdminTenantDetail`,
`AdminStoreListItem`, `AdminStoreDetail`, `SubscriptionPlan`,
`AdminSubscription`, `AdminAuditLog`).

Store theming is surfaced read-only: the store detail response reports the active
theme name, slug, and `publishedAt`. All theme writes stay on the merchant
endpoints — see [storefront-theming.md](./storefront-theming.md).

## Tenant and store suspension

Only `ACTIVE` and `SUSPENDED` may be set by a Super Admin. Lifecycle states
(`PENDING`, `INACTIVE`, `DRAFT`) stay system-owned, so the UI offers just the two
assignable values while still displaying any status the API returns.

**Tenant suspension** is enforced at read/authorization time. Store rows keep
their own `status` column untouched, which means reactivating a tenant restores
each storefront to the state it was in before the suspension — a tenant-level
suspend is not a cascade of store writes.

**Store suspension** stops that single storefront from serving requests and
blocks merchant writes. Catalog, customer and order data are preserved.

Both actions are irreversible-feeling enough to require a `ConfirmDialog`, and
both write an audit entry (`TENANT_SUSPENDED` / `TENANT_ACTIVATED`,
`STORE_SUSPENDED` / `STORE_ACTIVATED`).

## Last-admin protection

The API refuses two operations that would lock everyone out of the platform:

- Suspending a user who is the **last active** `SUPER_ADMIN`
  (`Cannot suspend the last active Super Admin`).
- Demoting that same user to `USER`
  (`Cannot demote the last active Super Admin`).

Both return `422 Unprocessable Entity`. "Last active" counts users that are both
`SUPER_ADMIN` **and** `ACTIVE`, excluding the target — so an already-suspended
Super Admin does not satisfy the requirement. The admin UI surfaces the API
message and appends "Promote another account first." rather than trying to
predict the condition client-side.

## Subscriptions

Plans are platform-owned pricing tiers. Deactivating a plan removes it from new
assignments (`Cannot assign an inactive subscription plan`) but leaves existing
subscriptions running on it.

Subscription status follows a state machine, mirrored in the UI by
`allowedSubscriptionTransitions` so the status dropdown only lists legal moves:

| From | Allowed to |
| --- | --- |
| `TRIALING` | `ACTIVE`, `CANCELLED`, `EXPIRED` |
| `ACTIVE` | `PAST_DUE`, `CANCELLED`, `EXPIRED` |
| `PAST_DUE` | `ACTIVE`, `CANCELLED`, `EXPIRED` |
| `CANCELLED` | `ACTIVE` (reactivation only) |
| `EXPIRED` | `ACTIVE` (reactivation only) |

Re-submitting the current status returns `400`; an illegal jump returns `422`.
The client mirror is a convenience only — the API re-validates every transition.

## Audit

`GET /admin/audit-logs` is the platform-wide view over the `AuditLog` table.
Filters: exact `action`, `userId` (actor), `tenantId`, `storeId`, and an
inclusive `from`/`to` date range. An inverted range is rejected client-side
before the request and by the API with `to must be after from`.

Actions written by this module:

`USER_SUSPENDED`, `USER_ACTIVATED`, `PLATFORM_ROLE_CHANGED`,
`TENANT_SUSPENDED`, `TENANT_ACTIVATED`, `STORE_SUSPENDED`, `STORE_ACTIVATED`,
`PLAN_CREATED`, `PLAN_UPDATED`, `PLAN_DEACTIVATED`, `SUBSCRIPTION_CREATED`,
`SUBSCRIPTION_STATUS_CHANGED`.

Each entry records the acting user, entity type/id, tenant/store scope, IP,
user agent and a metadata object holding the previous and new values. Tenant
detail pages show the ten most recent entries for that tenant and deep-link to
the filtered log.

## UI conventions

- Dangerous actions (suspend, deactivate plan, platform-role change,
  subscription status change) always route through `ConfirmDialog`.
- Validation runs client-side first (money format, slug length, date ranges) and
  API errors are surfaced verbatim through `humanApiError` plus a toast.
- Lists share the `LoadingState` / `ErrorState` / `EmptyState` / `Pagination`
  quartet.
- `StatusBadge` maps any status string to a tone: `ACTIVE` green; `PENDING`,
  `TRIALING`, `INVITED`, `DRAFT`, `PAST_DUE` amber; `SUSPENDED`, `CANCELLED`,
  `EXPIRED` red.

## Testing

`pnpm --filter @ecomesta/admin test` (vitest + jsdom + Testing Library) covers
the auth gate, every list surface and each confirm flow:

| File | Focus |
| --- | --- |
| `src/app/login/login-form.test.tsx` | Login submit, API error, non-admin blocked, admin redirect |
| `src/components/admin/admin-shell.test.tsx` | Loading, unauthenticated redirect, access-denied gate, sign-out |
| `src/app/dashboard/dashboard.test.tsx` | Metric rendering and deep links |
| `src/app/dashboard/users/users.test.tsx` | List, filters, no hash leakage, suspend confirm, role change + last-admin error |
| `src/app/dashboard/tenants/tenants.test.tsx` | List, empty state, suspend confirm, activate affordance |
| `src/app/dashboard/stores/stores.test.tsx` | List with tenant, status filter, suspend confirm, counts/domains, verification token never rendered |
| `src/app/dashboard/plans/plans.test.tsx` | List, price validation, create, deactivate confirm, edit prefill |
| `src/app/dashboard/subscriptions/subscriptions.test.tsx` | List, legal transitions only, status confirm, rejected transition |
| `src/app/dashboard/audit-logs/audit-logs.test.tsx` | List, query-string seeding, filters, metadata redaction, date validation |
| `src/components/ui/states.test.tsx` | Shared state components, pagination, confirm dialog |
