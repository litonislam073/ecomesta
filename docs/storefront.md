# Public Storefront (Phase 9)

Customer-facing browsing and anonymous cart for Ecomesta. No checkout or payments.

## Store resolution (local)

Multi-tenant stores are resolved without custom domains yet:

1. Query: `?store=<store-slug>` (preferred for local)
2. Cookie: `ecomesta.storeSlug` (set by middleware when query is present)
3. Env: `NEXT_PUBLIC_DEFAULT_STORE_SLUG`

Only stores with `StoreStatus.ACTIVE` are public. Inactive/draft/suspended → 404.

Store slugs are unique per tenant; if multiple ACTIVE stores share a slug, the API returns `409`.

## Public APIs (unauthenticated)

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/stores/:storeSlug` |
| GET | `/api/v1/public/stores/:storeSlug/categories` |
| GET | `/api/v1/public/stores/:storeSlug/categories/:categorySlug` |
| GET | `/api/v1/public/stores/:storeSlug/products` |
| GET | `/api/v1/public/stores/:storeSlug/products/:productSlug` |

Public product rules:

- Only `ProductStatus.ACTIVE`
- Draft/archived treated as not found (no existence leak)
- Availability is boolean only (no raw inventory / movements)
- No cost price, tenant IDs, auth, or audit fields

## Storefront routes (`apps/web`)

| Route | Purpose |
| --- | --- |
| `/` | Home + latest products + categories |
| `/products` | Listing, search, category, sort, pagination |
| `/products/[productSlug]` | Detail + add to cart |
| `/categories/[categorySlug]` | Category products |
| `/cart` | Full cart page |

## Cart architecture

- Anonymous, client-side only
- Persistence: `localStorage` key `ecomesta_cart_<storeSlug>`
- Separate carts per store (no cross-store mixing)
- Stores display snapshots (name, price, qty); server recalculates at checkout
- Checkout at `/checkout` → confirmation at `/order-confirmation/[publicReference]`

## Future gateway integration

Online payment gateways (Stripe, bKash, SSLCommerz, etc.) are not implemented. Phase 10 supports COD / offline methods only. See [checkout.md](./checkout.md).

## SEO

Next.js `generateMetadata` on home, products, product detail, and category pages using store/product/category data.

## Caching

Public fetches use `next: { revalidate: 30 }` in the storefront API helper. Development stays short-lived; never cache merchant-authenticated responses publicly.

## Security

- Store resolution server-side (cookie/query/env → public API)
- Cross-store product/category IDs cannot be used via another store’s slug
- Cart keys are store-scoped
- No tokens in localStorage

## Future checkout integration

## Future checkout integration

Public guest checkout is implemented in Phase 10 via `POST /api/v1/public/stores/:storeSlug/checkout`, which reuses `OrderPlacementService` (same inventory locks and snapshots as merchant create). See [checkout.md](./checkout.md).
