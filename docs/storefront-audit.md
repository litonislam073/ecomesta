# Storefront audit (Phase 9 pre-work)

## Current state of `apps/web`

- Placeholder Next.js App Router app on port **3000**
- Routes: `/` only (`layout.tsx`, `page.tsx`, `globals.css`)
- Uses `@ecomesta/ui` `AppShell` + `Button`
- Fonts: Source Sans 3 + Fraunces
- No API client, no store resolution, no cart, no env for API URL
- No Vitest setup yet
- No public catalog APIs in NestJS (merchant catalog requires auth)

## Approach for Phase 9

- Add unauthenticated `public` NestJS module keyed by **store slug**
- Only `StoreStatus.ACTIVE` stores and `ProductStatus.ACTIVE` / category ACTIVE
- Web: `?store=<slug>` (and `NEXT_PUBLIC_DEFAULT_STORE_SLUG`) for local resolution
- Client cart in `localStorage` keyed `ecomesta_cart_<storeSlug>`
- No Prisma schema changes (no product images linked; empty images array)
