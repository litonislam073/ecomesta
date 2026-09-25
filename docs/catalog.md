# Catalog, Categories & Inventory (Phase 5)

Store-scoped merchant APIs for categories, products, variants, and inventory.

All routes live under `/api/v1/stores/:storeId/...`. Authorization is enforced via `AuthorizationService` before any store-scoped query. `storeId` in the URL is never trusted from the request body.

## Money representation

- Database: `Decimal(12, 2)` (`Prisma.Decimal`)
- API input: decimal string or integer/number with at most 2 fractional digits (validated; converted to `Prisma.Decimal`, never used in floating-point arithmetic)
- API output: **string** with two decimals (e.g. `"1200.00"`)

Do not sum or multiply money with JavaScript `number`.

## Category model

| Field | Notes |
| --- | --- |
| `storeId` | Owning store (required) |
| `parentId` | Optional parent in the same store |
| `name`, `slug`, `description`, `imageUrl` | Merchant-facing fields |
| `status` | `DRAFT` \| `ACTIVE` \| `ARCHIVED` (create defaults to `ACTIVE`; status not accepted on create body) |

Slug is unique per store (`storeId + slug`). Parent must belong to the same store. Cycle detection walks ancestors iteratively (bounded depth) when `parentId` changes.

### Delete policy

Deletion is rejected with **409** when:

- child categories exist, or
- products are assigned via `ProductCategory`

No cascade delete of products.

## Product model

| Field | Notes |
| --- | --- |
| `storeId` | Owning store |
| `slug` | Unique per store |
| `sku` | Unique per store when non-null (partial unique index) |
| `basePrice` / `compareAtPrice` / `costPrice` | `Decimal(12, 2)` |
| `status` | `DRAFT` \| `ACTIVE` \| `ARCHIVED` |
| `productType` | `PHYSICAL` \| `DIGITAL` \| `SERVICE` |
| `trackInventory` / `allowBackorder` | Inventory behavior flags |
| `categoryIds` | Many-to-many via `ProductCategory`; all must belong to the store |

### Deletion / archive strategy

`DELETE /products/:productId` **archives** the product (`status = ARCHIVED`). Rows are not hard-deleted so future order history can reference them. Variants are not cascade-deleted by archive.

## Variant model

Variants belong to a product **and** the same store (`storeId` denormalized). SKU unique per store when non-null. Prices use the same money rules.

Deleting a variant requires zero on-hand and reserved inventory for that variant row.

## Inventory model

Uses existing `InventoryItem` and `InventoryMovement`.

### Initialization

- Product with `trackInventory=true` and **no variants** → one `InventoryItem` with `variantId = null`
- When the **first variant** is created → product-level row is removed and stock is migrated onto that variant
- Additional variants start at quantity `0`
- When the last variant is deleted → product-level inventory row is recreated if tracking is on

Partial unique indexes prevent duplicate product-level or variant-level rows.

### Adjustment

`POST .../inventory/adjust` accepts a **signed delta** (`quantity`), creates an `InventoryMovement` (`ADJUSTMENT`), and updates `InventoryItem.quantity` in one transaction.

Concurrency: `SELECT ... FOR UPDATE` on the inventory row inside a Prisma interactive transaction before computing the next quantity.

Rules:

- `quantity >= 0` unless `allowBackorder` is true
- `reservedQuantity <= quantity` unless backorder is allowed
- Phase 5 endpoint only accepts `type: ADJUSTMENT`

Movement history is append-only via the API (no delete endpoint).

## Authorization

| Action | Required |
| --- | --- |
| Read categories / products / inventory | Store access (`STORE_STAFF+`, tenant OWNER/ADMIN, or Super Admin) |
| Create/update/delete categories | `STORE_MANAGER` (or tenant OWNER/ADMIN / Super Admin) |
| Create/update/archive products & variants | `STORE_MANAGER` (or elevated) |
| Adjust inventory | `STORE_MANAGER` (or elevated) |

`STORE_STAFF` is read-only for catalog and inventory.

Cross-store IDOR attempts return **403** (no access to store) or **404** (resource not in the authorized store).

## Endpoints

### Categories

- `POST /api/v1/stores/:storeId/categories`
- `GET /api/v1/stores/:storeId/categories` (`search`, `parentId`, `status`, pagination, optional `tree=true`)
- `GET /api/v1/stores/:storeId/categories/:categoryId`
- `PATCH /api/v1/stores/:storeId/categories/:categoryId`
- `DELETE /api/v1/stores/:storeId/categories/:categoryId`

### Products

- `POST /api/v1/stores/:storeId/products`
- `GET /api/v1/stores/:storeId/products`
- `GET /api/v1/stores/:storeId/products/:productId`
- `PATCH /api/v1/stores/:storeId/products/:productId`
- `DELETE /api/v1/stores/:storeId/products/:productId` (archive)

### Variants

- `POST /api/v1/stores/:storeId/products/:productId/variants`
- `GET /api/v1/stores/:storeId/products/:productId/variants`
- `GET /api/v1/stores/:storeId/products/:productId/variants/:variantId`
- `PATCH /api/v1/stores/:storeId/products/:productId/variants/:variantId`
- `DELETE /api/v1/stores/:storeId/products/:productId/variants/:variantId`

### Inventory

- `GET /api/v1/stores/:storeId/inventory`
- `GET /api/v1/stores/:storeId/inventory/:inventoryItemId`
- `POST /api/v1/stores/:storeId/inventory/adjust`
- `GET /api/v1/stores/:storeId/inventory/:inventoryItemId/movements`

## Audit actions

`CATEGORY_CREATED` / `UPDATED` / `DELETED`, `PRODUCT_CREATED` / `UPDATED` / `ARCHIVED`, `VARIANT_CREATED` / `UPDATED` / `DELETED`, `INVENTORY_ADJUSTED`.

## Pagination

Offset pagination: `page` (default 1), `limit` (default 20, max 100). Response includes `items` and `meta` (`total`, `page`, `limit`, `totalPages`).
