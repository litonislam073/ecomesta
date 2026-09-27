# Storefront Theming (Phase 16)

Merchant-controlled storefront appearance: a selectable theme plus a validated
JSON configuration that the public storefront renders as CSS variables and
content blocks.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `Theme` (Prisma) | Installable theme record: `slug`, `name`, `version`, `description`, `previewImageUrl`, default `configuration` |
| `StoreTheme` (Prisma) | Per-store selection plus `configuration` (draft) and `publishedConfiguration` (live snapshot), `publishedAt`, `isActive` |
| `ThemesService` (`apps/api/src/modules/themes`) | Merchant reads/writes, publish, reset, preview; audit logging |
| `PublicThemesService` | Published snapshot only, Redis-cached, for the storefront |
| `apps/merchant/src/app/dashboard/theme` | Theme customizer with a live in-app preview |
| `apps/web/src/components/storefront` | `ThemeProvider` plus themed chrome and homepage blocks |

Both models already existed in the schema, so Phase 16 adds no new tables. A
store without a `StoreTheme` row gets one materialized from the `default` theme
on first read, and missing built-in themes are self-healed by
`ThemesService.ensureBuiltInThemes()`.

Built-in themes: `default` (hero + featured categories/products) and `minimal`
(typography-led). Their definitions live in `theme-config.types.ts` so the
Prisma seed and the runtime share one source of truth.

## Draft vs published

- `configuration` is the **draft**. `PATCH .../theme` merges a partial patch into
  it section by section: object keys overwrite, arrays are replaced wholesale.
- `publishedConfiguration` is the **live snapshot**. Only `POST .../theme/publish`
  copies the draft into it and stamps `publishedAt`.
- `hasUnpublishedChanges` compares the two with an order-insensitive JSON
  comparison so merchants can see whether a publish is pending.
- `POST .../theme/reset` restores the draft to theme defaults; the published
  storefront is untouched until the next publish.
- Publishing also syncs `Store.logoUrl` / `Store.faviconUrl` when branding sets
  them, so emails and admin surfaces match the storefront.
- The public endpoint never returns the draft. Merchants preview drafts through
  the authenticated `POST .../theme/preview` payload and the in-dashboard
  preview panel — there is no unauthenticated preview URL.

## APIs

Merchant (bearer token, store-scoped):

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/v1/stores/:storeId/theme` | store read access |
| GET | `/api/v1/stores/:storeId/themes` | store read access (list with `selected`) |
| PATCH | `/api/v1/stores/:storeId/theme` | `STORE_MANAGER` (or tenant OWNER/ADMIN, SUPER_ADMIN) |
| POST | `/api/v1/stores/:storeId/theme/publish` | same as PATCH |
| POST | `/api/v1/stores/:storeId/theme/reset` | same as PATCH |
| POST | `/api/v1/stores/:storeId/theme/preview` | store read access (draft config) |

Public (unauthenticated, ACTIVE stores only):

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/stores/:storeSlug/theme` |

Admin (read-only): `GET /api/v1/admin/stores/:storeId` includes
`theme: { name, slug, publishedAt } | null` for the active selection. There is no
admin write path for theming.

Shared contracts in `@ecomesta/types`: `StoreThemeConfig`, `StoreTheme`,
`ThemeSummary`, `ThemeListItem`, `UpdateStoreThemeRequest`, `PublicStoreTheme`.

## Validation

`normalizeThemeConfiguration` is a pure whitelist pass over the payload:

- Unknown keys are **stripped**; known keys with unusable values raise `400`
  with a `configuration.<path>` message.
- Sections: `branding`, `typography`, `announcement`, `header`, `hero`,
  `homepage`, `footer`, `seo`.
- Text is trimmed, length-capped, and rejected when it contains `<` or `>`.
- Colors must match `#rgb` or `#rrggbb` and are lowercased.
- URLs must be absolute `http(s)` or site-relative starting with a single `/`
  (protocol-relative `//host` is rejected).
- Enums are closed lists: border radius, header layout, hero alignment, homepage
  section type, social network.
- Numbers are range-checked (base font size 12–24, overlay opacity 0–1, heading
  letter spacing -5–10).
- Featured category/product ids must be UUIDs and are de-duplicated; arrays have
  item caps (`THEME_LIMITS`).

The merchant UI mirrors these rules: invalid colors are flagged and dropped from
the patch, and non-UUID featured ids are ignored, so a half-typed field never
fails a save.

## Cache

`PublicThemesService` caches the published payload in Redis under
`theme:published:<storeId>` for 60 seconds (`PUBLISHED_THEME_CACHE_TTL_SECONDS`).
Publishing deletes the key; cache reads and writes are best-effort so Redis
downtime degrades to a database read rather than a storefront error. Storefront
fetches additionally use the shared `next: { revalidate: 30 }` helper.

## Security

- Reads require store access; every write requires `STORE_MANAGER` (or tenant
  OWNER/ADMIN, or SUPER_ADMIN) via `AuthorizationService`. The merchant UI gates
  on `useCanManageStore()` for UX only.
- Config text can never carry markup, and the storefront renders it as text —
  no `dangerouslySetInnerHTML` anywhere in the theming path.
- Colors reaching CSS are re-validated in `apps/web/src/lib/theme.ts`, and font
  families are mapped through a whitelist (`Inter`, `Work Sans`,
  `IBM Plex Sans`, `Source Sans 3`, `Georgia`, `Fraunces`, system stack), so a
  stored value can never inject a CSS declaration.
- The public payload exposes only the published snapshot and the theme
  `slug`/`name`; drafts, ids, and audit fields stay server-side.
- `THEME_SELECTED`, `THEME_UPDATED`, `THEME_PUBLISHED`, and `THEME_RESET` are
  written to the audit log with the acting user, tenant, and store.

## Merchant customizer

`/dashboard/theme` (legacy `/dashboard/themes` redirects here) renders one card
per configuration section plus a sticky live preview:

`ThemeSelector`, `BrandingSection`, `TypographySection`, `AnnouncementSection`,
`HeaderSection`, `HeroSection`, `HomepageSection`, `FooterSection`,
`SeoSection`, `ThemePreview` — all under `src/components/theme/`.

The preview is a simplified in-app mock of the announcement bar, header, hero,
homepage blocks, and footer. It renders from the **unsaved draft** using the same
CSS variables the storefront consumes, which avoids shipping an unauthenticated
preview surface. Actions are Save draft (`PATCH`), Publish and Reset (both
`POST`, behind `ConfirmDialog`). Staff without manage access see every field
disabled and no action buttons.

## Storefront rendering

`apps/web/src/app/(store)/layout.tsx` fetches the store and its published theme
in parallel and passes both to `StorefrontProviders`, which wraps the tree in
`ThemeProvider`. The provider exposes the configuration through context and sets
CSS custom properties on a `display: contents` element, so unset values keep the
packaged defaults:

| Variable | Source |
| --- | --- |
| `--color-accent` / `--color-accent-hover` | `branding.primaryColor` (hover is a computed shade) |
| `--theme-secondary` / `--theme-accent` | `branding.secondaryColor` / `branding.accentColor` |
| `--color-bg`, `--color-surface`, `--color-ink`, `--color-muted` | background, surface, text, muted colors |
| `--theme-radius` | `branding.borderRadius` |
| `--font-display` / `--font-sans` | whitelisted `typography.headingFont` / `bodyFont` |
| `--theme-base-font-size`, `--theme-heading-tracking` | typography sizes |

Components under `src/components/storefront/`: `ThemeProvider`,
`AnnouncementBar`, `StorefrontHeader`, `StorefrontFooter`, `HeroSection`,
`FeaturedCategories`, `FeaturedProducts`.

The homepage renders the configured hero and only the enabled homepage sections,
resolving `homepage.featuredProducts` / `featuredCategories` against published
records and falling back to the previous behavior (latest products, all
categories) when nothing is configured. `generateMetadata` uses the store SEO
settings first (Settings → SEO, see [merchant-settings.md](./merchant-settings.md)),
then the theme's legacy `seo.title`, `seo.description`, `seo.keywords` and
`seo.ogImageUrl`, then branding and store fields; `branding.faviconUrl` still sets
the favicon. The theme customizer no longer edits `seo`; existing values are kept in
the configuration as a fallback.
