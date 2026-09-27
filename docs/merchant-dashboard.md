# Merchant Dashboard (Phase 6B–14)

Next.js App Router app in `apps/merchant` (port **3002**).

> **Scope:** this app is for tenant and store members only. Platform-wide
> administration (users, tenants, stores, plans, subscriptions, audit logs) lives
> in a separate Super Admin console at `apps/admin` on port **3003** — see
> [admin-platform.md](./admin-platform.md). The merchant app has no Super Admin
> surface, and `platformRole` is never used to unlock merchant features here.

## Architecture

```
Browser
  → Merchant UI (Next.js)
  → NEXT_PUBLIC_API_URL (/api/v1)
  → NestJS AuthorizationService
  → PostgreSQL
```

Frontend store selection and role-based nav are **UX only**. Backend authorization remains authoritative.

## Authentication

- Login: `POST /auth/login` with `{ email, password }`
- Access token kept in React memory (`AuthProvider`)
- Refresh via HttpOnly cookie: `POST /auth/refresh` with `credentials: 'include'`
- Logout: `POST /auth/logout`
- Profile: `GET /auth/me`

Refresh tokens are **not** stored in `localStorage`.

## Store selector

- Loads `GET /stores` (accessible stores only)
- Persists `selectedStoreId` in `sessionStorage` for convenience
- Never treated as authorization proof; every API call still goes through store-scoped backend checks
- Catalog pages use `StoreScoped` to remount and clear stale data on store switch

## API client

`apps/merchant/src/lib/api-client.ts`

- JSON helpers for GET/POST/PATCH/DELETE
- Attaches Bearer access token
- Sends cookies for refresh
- Normalizes errors to `ApiError`
- Clears session on 401

Configure with `NEXT_PUBLIC_API_URL` (see `.env.example`).

## Routes

| Route | Status |
| --- | --- |
| `/login` | Functional |
| `/dashboard` | Functional (account/store context) |
| `/dashboard/stores` | Functional list |
| `/dashboard/customers` | Functional CRUD UI |
| `/dashboard/customers/[id]` | Functional detail + addresses |
| `/dashboard/products` | Functional list + filters |
| `/dashboard/products/new` | Functional create |
| `/dashboard/products/[productId]` | Functional edit + variants |
| `/dashboard/categories` | Functional tree/list CRUD |
| `/dashboard/orders` | Functional list + filters/sort/search (Phase 13) |
| `/dashboard/orders/[orderId]` | Detail + timeline + cancel reason + shipments (Phase 13) |
| `/dashboard/inventory` | Functional stock + adjustments |
| `/dashboard/inventory/[inventoryItemId]` | Functional movement history |
| `/dashboard/shipping` | Functional zones + methods CRUD (Phase 11 + Phase 20 BD delivery) |
| `/dashboard/payments` | Functional payment list (Phase 11) |
| `/dashboard/payments/[paymentId]` | Functional payment detail + status |
| `/dashboard/settings` | Merchant Settings overview + General, Store details, Checkout, Orders, Customers, Notifications, Shipping, Domains, SEO, Danger zone — see [merchant-settings.md](./merchant-settings.md) |
| `/dashboard/settings/payments` | TEST + Stripe + SSLCommerz provider config (masked secrets, validate) (Phase 12/18/19) |
| `/dashboard/coupons` | Coupon list + search/status (Phase 14) |
| `/dashboard/coupons/new` | Create coupon |
| `/dashboard/coupons/[couponId]` | Edit / deactivate coupon |
| `/dashboard/theme` | Theme selector + storefront customizer with live preview (Phase 16) |
| `/dashboard/themes` | Redirects to `/dashboard/theme` |
| `/dashboard/domains` | Custom domain list, DNS TXT verify, activate / primary / disable / delete (Phase 17) |
| Order create UI | Placeholder or deferred |

See [catalog-dashboard.md](./catalog-dashboard.md), [order-tracking.md](./order-tracking.md), [shipping.md](./shipping.md), [payments.md](./payments.md), [coupons.md](./coupons.md), [storefront-theming.md](./storefront-theming.md), and [custom-domains.md](./custom-domains.md).

Store settings writes require STORE_MANAGER or tenant OWNER/ADMIN; the UI reads `permissions.canEdit` from `GET /stores/:storeId/settings`.

Coupon, theme, and domain writes require `useCanManageStore()` (STORE_MANAGER+); STORE_STAFF is read-only. Backend authorization is authoritative.

## UI components

Merchant-local (`src/components/ui`): Input, Select, Badge, Card, EmptyState, LoadingState, ErrorState, Pagination, ConfirmDialog, Toast.

Catalog (`src/components/catalog`): ProductForm, CategoryForm, CategoryTree, VariantForm, InventoryAdjustmentForm, StatusBadge, StoreScoped.

Theme (`src/components/theme`): ThemeSelector, BrandingSection, TypographySection, AnnouncementSection, HeaderSection, HeroSection, HomepageSection, FooterSection, SeoSection, ThemePreview, plus shared theme field inputs.

Domains (`src/components/domains`): DomainList, AddDomainForm, DnsInstructions, DomainStatusBadge, CopyValue.

Shared (`@ecomesta/ui`): Button (+ danger variant), AppShell.

## Authorization approach

1. Dashboard shell redirects unauthenticated users to `/login`
2. Sidebar marks unfinished modules as “Soon”; catalog/customer routes are ready
3. `useCanManageStore` hides write CTAs for `STORE_STAFF` (UX only)
4. Store-scoped APIs still enforce membership and roles server-side
5. A `SUPER_ADMIN` signing in here gets ordinary merchant access scoped to their own memberships; platform powers require `apps/admin`
