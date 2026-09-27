# Public Storefront (Phase 9–14)

Customer-facing browsing, anonymous cart, checkout, and coupon apply for Ecomesta.

## Store resolution

Priority (see [custom-domains.md](./custom-domains.md)):

1. Query: `?store=<store-slug>` — always wins (local multi-tenant and support links)
2. Hostname: middleware calls `GET /api/v1/public/domain/resolve?host=` for non-loopback hosts and sets `ecomesta.storeSlug` + `ecomesta.canonicalHost`
3. Cookie: `ecomesta.storeSlug` from a prior resolve or `?store=`
4. Env: `NEXT_PUBLIC_DEFAULT_STORE_SLUG`

Pure `localhost` / `127.0.0.1` skips host resolve so local `?store=` / cookie / env keep working. Platform subdomains like `{slug}.ecomesta.local` **do** resolve (`.local` is not loopback).

Only stores with `StoreStatus.ACTIVE` are public. Inactive/draft/suspended → 404. Unknown hosts rewrite to `/store-not-found`.

Store slugs are globally unique (`stores_slug_key`) because each slug is the `{slug}.{PLATFORM_ROOT_DOMAIN}` label. The reserved labels `www`, `api`, `admin` and `merchant` are rejected, and a taken slug returns `409`.

## Public APIs (unauthenticated)

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/stores/:storeSlug` |
| GET | `/api/v1/public/stores/:storeSlug/categories` |
| GET | `/api/v1/public/stores/:storeSlug/categories/:categorySlug` |
| GET | `/api/v1/public/stores/:storeSlug/products` |
| GET | `/api/v1/public/stores/:storeSlug/products/:productSlug` |
| GET | `/api/v1/public/stores/:storeSlug/theme` |

Public product rules:

- Only `ProductStatus.ACTIVE`
- Draft/archived treated as not found (no existence leak)
- Availability is boolean only (no raw inventory / movements)
- No cost price, tenant IDs, auth, or audit fields

## Theming (Phase 16)

The store layout fetches the published theme alongside the store and wraps the
tree in `ThemeProvider`, which sets CSS variables from `branding` and
`typography`. `AnnouncementBar`, `StorefrontHeader`, `HeroSection`,
`FeaturedCategories`, `FeaturedProducts`, and `StorefrontFooter` live under
`src/components/storefront/`. Unconfigured stores keep the packaged defaults and
the pre-Phase-16 homepage behavior. Only the published snapshot is public — see
[storefront-theming.md](./storefront-theming.md).

## Storefront routes (`apps/web`)

| Route | Purpose |
| --- | --- |
| `/` | Themed hero + featured categories/products (falls back to latest products) |
| `/products` | Listing, search, category, sort, pagination |
| `/products/[productSlug]` | Detail + add to cart |
| `/categories/[categorySlug]` | Category products |
| `/cart` | Full cart page |

## Cart architecture

- Anonymous, client-side only
- Persistence: `localStorage` key `ecomesta_cart_<storeSlug>`
- Separate carts per store (no cross-store mixing)
- Optional `couponCode` lives inside the same store-scoped cart state (no cross-store leak)
- Stores display snapshots (name, price, qty); server recalculates at checkout
- Checkout at `/checkout` (coupon Apply/Remove) → confirmation at `/order-confirmation/[publicReference]`
- Tracking/confirmation show discount + coupon code when present

## Coupons

Preview: `POST /api/v1/public/stores/:storeSlug/coupons/validate`. Final discount is always recomputed in the checkout transaction. See [coupons.md](./coupons.md).

## Future gateway integration

Online payment gateways: Stripe Checkout (Phase 18) and SSLCommerz v4 (Phase 19) are implemented. Other gateways (bKash, Nagad, etc.) are not productized yet. Offline + TEST remain. See [checkout.md](./checkout.md), [payment-providers.md](./payment-providers.md), and [sslcommerz.md](./sslcommerz.md).

## SEO

Next.js `generateMetadata` on home, products, product detail, and category pages using store/product/category data. The home page prefers the published theme’s `seo.title`, `seo.description`, `seo.keywords`, `seo.ogImageUrl`, and `branding.faviconUrl`. When middleware resolved a primary hostname, `metadataBase` and absolute canonical URLs use that host (`storeMetadataBase` / `storeCanonicalUrl` in `store-resolver`).

## Caching

Public fetches use `next: { revalidate: 30 }` in the storefront API helper. Development stays short-lived; never cache merchant-authenticated responses publicly. Published themes are additionally cached in Redis for 60s and invalidated on publish.

## Security

- Store resolution server-side (Host resolve / cookie / query / env → public API)
- Cross-store product/category IDs cannot be used via another store’s slug
- Cart keys are store-scoped
- No tokens in localStorage
- DNS verification tokens never appear on the public storefront

## Future checkout integration

## Future checkout integration

Public guest checkout is implemented in Phase 10 via `POST /api/v1/public/stores/:storeSlug/checkout`, which reuses `OrderPlacementService` (same inventory locks and snapshots as merchant create). See [checkout.md](./checkout.md).
