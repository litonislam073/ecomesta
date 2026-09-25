# Catalog Dashboard (Phase 7)

Merchant catalog management UI in `apps/merchant` for products, variants, categories, and inventory. All screens consume existing store-scoped NestJS APIs. No Phase 8 domains (orders, checkout, payments, etc.).

## Product management UI

| Route | Purpose |
| --- | --- |
| `/dashboard/products` | Paginated product table with search, status, type, category filters, sorting |
| `/dashboard/products/new` | Create product |
| `/dashboard/products/[productId]` | Edit product + variants |

APIs:

- `GET/POST /api/v1/stores/:storeId/products`
- `GET/PATCH/DELETE /api/v1/stores/:storeId/products/:productId`

`DELETE` archives (`ARCHIVED`); the UI labels this as archive, not permanent delete.

Empty stores show an empty state with an **Add product** CTA (when the user can write).

## Variant management

Nested on the product detail page (no separate option-matrix UI).

- List, create, edit, delete via `/products/:productId/variants`
- Fields: name, SKU, barcode, price, compare-at, cost, weight, status
- Confirmation required before delete

## Category management

| Route | Purpose |
| --- | --- |
| `/dashboard/categories` | Tree + list views, search, parent filter, pagination (list mode) |

APIs: `GET/POST/PATCH/DELETE /api/v1/stores/:storeId/categories` (`tree=true` for nested view).

- Parent picker excludes self and descendants (UI guard; backend still validates cycles)
- `409` on delete → human message: category still in use (children or products)

Reusable: `CategoryTree`, `CategoryForm`.

## Inventory management

| Route | Purpose |
| --- | --- |
| `/dashboard/inventory` | Stock table + adjust dialog |
| `/dashboard/inventory/[inventoryItemId]` | Read-only movement history |

APIs:

- `GET /api/v1/stores/:storeId/inventory` — supports `search`, `stockStatus` (`low` / `out` / `in_stock`), `productId`, pagination
- `POST /api/v1/stores/:storeId/inventory/adjust` — `ADJUSTMENT` deltas only
- `GET .../inventory/:id` and `.../movements`

Available quantity comes from the API (`quantity - reserved`). Client never treats local math as authoritative after adjust.

## Store context

Catalog pages wrap content in `StoreScoped`, which remounts children when `selectedStoreId` changes so previous-store state cannot linger. Lists refetch from the selected store’s APIs.

## Role-based UI behavior

`useCanManageStore()` (UX only):

| Role | View | Write (create/edit/archive/adjust) |
| --- | --- | --- |
| `STORE_STAFF` | Yes | Hidden |
| `STORE_MANAGER` | Yes | Shown |
| Tenant `OWNER` / `ADMIN` | Yes | Shown |
| `SUPER_ADMIN` | Yes | Shown |

Backend `AuthorizationService` remains the security boundary. `403` responses surface as permission errors.

## API integration

Single client: `apps/merchant/src/lib/api-client.ts`. Shared types from `@ecomesta/types`. Errors normalized via `ApiError` + `humanApiError()`.

## Error handling

| Status | UX |
| --- | --- |
| 401 | Session cleared / re-login |
| 403 | Permission message |
| 404 | Not found empty/error state |
| 409 / 422 | Human-readable conflict (category in use, negative stock, etc.) |
| 500 / network | Generic recoverable error with retry |

No Prisma/stack/raw JSON dumps in the UI.
