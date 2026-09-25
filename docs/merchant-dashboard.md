# Merchant Dashboard (Phase 6B + Phase 7 + Phase 8)

Next.js App Router app in `apps/merchant` (port **3002**).

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
| `/dashboard/orders` | Functional list + filters |
| `/dashboard/orders/[orderId]` | Functional detail + status updates |
| `/dashboard/inventory` | Functional stock + adjustments |
| `/dashboard/inventory/[inventoryItemId]` | Functional movement history |
| Orders create UI / Payments / Themes / Domains / etc. | Placeholder or deferred |

See [catalog-dashboard.md](./catalog-dashboard.md) for catalog UI details.

## UI components

Merchant-local (`src/components/ui`): Input, Select, Badge, Card, EmptyState, LoadingState, ErrorState, Pagination, ConfirmDialog, Toast.

Catalog (`src/components/catalog`): ProductForm, CategoryForm, CategoryTree, VariantForm, InventoryAdjustmentForm, StatusBadge, StoreScoped.

Shared (`@ecomesta/ui`): Button (+ danger variant), AppShell.

## Authorization approach

1. Dashboard shell redirects unauthenticated users to `/login`
2. Sidebar marks unfinished modules as “Soon”; catalog/customer routes are ready
3. `useCanManageStore` hides write CTAs for `STORE_STAFF` (UX only)
4. Store-scoped APIs still enforce membership and roles server-side
