# Merchant Settings

Store-level settings for merchants, at `/dashboard/settings` in the merchant app.
Appearance (colours, fonts, logo, homepage sections) stays in **Theme**
(`/dashboard/theme`); the two are intentionally separate.

## Data model

Settings live on the existing `stores` row — there is no separate settings table.
Migration `20260927030000_merchant_store_settings` added only the columns that did
not already exist and changed defaults for new stores.

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| `currency` | `char(3)` | `BDT` | Existing column; default changed from USD. Read-only in the UI. |
| `timezone` | `text` | `Asia/Dhaka` | Existing column; default changed from UTC. Read-only in the UI. |
| `locale` | `text` | `en-BD` | Existing column; drives storefront language (`en-BD` / `bn-BD`). |
| `email`, `phone`, `address` | varchar | `null` | Existing nullable columns, now editable and shown in the storefront footer. |
| `checkout_require_phone` | boolean | `false` | New. |
| `checkout_allow_order_notes` | boolean | `true` | New. |
| `allow_customer_cancellation` | boolean | `false` | New. |
| `seo_title` / `seo_description` | varchar(120 / 320) | `null` | New. Backfilled from the published theme `seo` block. |
| `seo_keywords` | `text[]` | `{}` | New. Backfilled from the published theme. |
| `og_title` / `og_description` / `og_image_url` | varchar | `null` | New. `og_image_url` backfilled only when it is an http(s) URL. |
| `seo_indexing_enabled` | boolean | `true` | New. |

Existing stores keep their current currency and timezone; only newly created stores
get the Bangladesh defaults.

Reused, not duplicated: store `name`, `description`, `slug`, `status`; logo and
favicon (theme branding); payment providers; shipping zones/methods; domains.

## API

All routes require a bearer token and use `ParseUUIDPipe` on `:storeId`.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/v1/stores/:storeId/settings` | Any active store member, tenant OWNER/ADMIN |
| `PATCH` | `/api/v1/stores/:storeId/settings` | STORE_MANAGER, tenant OWNER/ADMIN |
| `GET` | `/api/v1/stores/:storeId/settings/summary` | Any active store member, tenant OWNER/ADMIN |
| `POST` | `/api/v1/public/stores/:storeSlug/orders/:publicReference/cancel` | Public (contact proof + store setting) |

Suspended stores and suspended tenants are denied (403). Members of another tenant
get 403 (no IDOR).

### GET response

A flat, explicit DTO — never the raw Prisma row. It includes the editable fields
above plus `storeId`, `name`, `slug`, `status`, `businessName` (tenant name),
`defaultLanguage` (`en` | `bn`), `createdAt`, `updatedAt`, a `fixed` block describing
rules that cannot be changed (guest checkout, required email and shipping address,
non-editable currency/timezone/slug, cancellable statuses) and
`permissions.canEdit` for the calling user.

### PATCH body

All fields optional; only provided fields are changed.

| Field | Validation |
| --- | --- |
| `name` | 2–120 chars, no `<` or `>`, cannot be null |
| `description` | ≤ 1000 chars |
| `email` | valid email, ≤ 255 |
| `phone` | `+`, digits, spaces, `-`, `()`; 6–40 chars |
| `address` | ≤ 500 chars |
| `defaultLanguage` | `en` or `bn` |
| `checkoutRequirePhone`, `checkoutAllowOrderNotes`, `allowCustomerCancellation`, `seoIndexingEnabled` | boolean, cannot be null |
| `seoTitle` / `ogTitle` | plain text (no `<>`), ≤ 120 |
| `seoDescription` / `ogDescription` | plain text (no `<>`), ≤ 320 |
| `seoKeywords` | ≤ 20 unique strings, each ≤ 60, plain text |
| `ogImageUrl` | absolute `http(s)` URL only — `javascript:` and relative URLs are rejected |
| `expectedUpdatedAt` | optional ISO timestamp for optimistic concurrency |

Empty strings clear optional text fields. Any other property — `tenantId`, `storeId`,
`ownerId`, `status`, `slug`, `currency`, `timezone`, `subscriptionId`, `createdAt`,
`updatedAt`, security fields — is rejected with 400 by the global
`forbidNonWhitelisted` validation pipe.

If `expectedUpdatedAt` does not match, or another write lands between read and
update, the API returns **409** and the UI asks the user to reload.

### Audit

Each successful update writes `STORE_SETTINGS_UPDATED` with `changedFields`,
`groups` (`general`, `checkout`, `orders`, `seo`) and clipped `from`/`to` values.
No secrets are ever part of settings, so none can be logged. Customer cancellations
write `ORDER_CANCELLED` and `ORDER_INVENTORY_RESTORED` with `source: "customer"` and
no user id.

### Summary

`/settings/summary` powers the read-only Payments, Shipping, Domains and Theme cards:

- `payments`: offline methods and enabled online providers as `{ provider, mode }`
  only. Secrets, `hasSecrets` flags and encrypted blobs are never included.
- `shipping`: method, active method, COD method and zone counts.
- `domains`: platform and primary hostnames plus custom domain counts. Verification
  tokens are never included.
- `theme`: active theme name, publish time, logo and favicon.

## Storefront effects

The public store DTO (`GET /api/v1/public/stores/:slug`) now includes `language`,
`contact`, `checkout` (`requireEmail`, `requirePhone`, `allowOrderNotes`),
`allowCustomerCancellation` and `seo`.

- **SEO metadata:** the homepage uses store SEO first, then the legacy theme `seo`
  block, then branding/store name. OG title/description fall back to the SEO
  title/description. When indexing is disabled every storefront page emits
  `<meta name="robots" content="noindex, nofollow">` (homepage metadata plus the
  `(store)` layout). The canonical URL still comes from the primary domain.
- **Language:** the storefront wrapper gets `lang="bn"` or `lang="en"`; the root
  layout stays static so the marketing site is unaffected. `og:locale` is `bn_BD`
  or `en_BD`.
- **Contact:** email (mailto), phone (tel) and address appear in the footer when set.
- **Checkout:** when `checkoutRequirePhone` is on the form marks phone as required
  and the API rejects orders without a contact or shipping phone (400). When order
  notes are off the field is hidden and the API drops any `customerNote`.
- **Customer cancellation:** see below.

- **Product and category pages:** title is `{product or category name} | {store name}`.
  The description uses the page's own text first (product short description, then
  full description; category description), clipped to 160 plain-text characters,
  then falls back to the store SEO description chain above. Canonical URLs,
  OpenGraph (title, description, URL, site name, locale, image) and `noindex` follow
  the same rules as the homepage. Products and categories have no dedicated SEO
  fields, so their own name and description act as their SEO values.

### Caching

Every successful settings save clears the store's Redis domain-resolution entries
(`storefront:domain:<hostname>`), which embed the store name, description and
locale. The web app fetches the public store payload with `cache: "no-store"`, so
the next storefront request after a save shows the new settings. Catalog, theme
and other public reads keep the existing 30-second data cache, and the published
theme keeps its own Redis cache (cleared on publish).

## Customer cancellation

When `allowCustomerCancellation` is on, the order tracking page shows **Cancel
order** for eligible orders. The request must include the same contact proof as
order tracking (email or phone), is rate limited (10 per minute per IP per store),
and is refused with 422 unless the order:

- is `PENDING` or `CONFIRMED`,
- is `UNFULFILLED` with no shipments,
- has order payment status `PENDING`, `FAILED` or `CANCELLED`, and
- has no Stripe, SSLCommerz or TEST payment that is pending, authorized or paid
  (online refunds are not automated).

Cancelling restocks inventory in the same transaction and records
`Cancelled by customer[: reason]` as the cancel reason. Merchants can always cancel
from the order page as before.

## Merchant UI

| Route | Contents |
| --- | --- |
| `/dashboard/settings` | Overview cards for every section |
| `/dashboard/settings/general` | Name, description, storefront language; read-only business, slug, currency, timezone |
| `/dashboard/settings/store` | Support email, phone, address; link to Theme for logo/favicon |
| `/dashboard/settings/checkout` | Require phone, allow notes; fixed rules; links to payments and shipping |
| `/dashboard/settings/orders` | Customer cancellation toggle and eligibility rules |
| `/dashboard/settings/customers` | Guest checkout explanation (no customer accounts); link to Customers |
| `/dashboard/settings/notifications` | "Notification infrastructure will be connected when email delivery is enabled." |
| `/dashboard/settings/payments` | Existing payment provider page, unchanged |
| `/dashboard/settings/shipping` | Summary with link to `/dashboard/shipping` |
| `/dashboard/settings/domains` | Summary with link to `/dashboard/domains` |
| `/dashboard/settings/seo` | Search and social fields, length warnings (title 10–70, description 50–160; warnings only), search preview, indexing toggle, read-only canonical |
| `/dashboard/settings/danger-zone` | Current status; "Store deletion is managed by platform administration." |

The settings layout shows a left nav on desktop and a section picker on mobile. The
dashboard sidebar expands the Settings item into its sections on settings routes.
Users without edit permission (STORE_STAFF) see disabled fields, a read-only notice
and no save buttons; the API enforces the same rule. The theme editor's SEO panel is
now a link to Settings → SEO; existing theme `seo` values are preserved and used only
as a fallback.

## Deferred

- Store deletion and disabling remain Super Admin actions (admin console).
- Email notifications (no email delivery infrastructure yet).
- Editable currency and timezone (would affect existing prices, orders and reports).
- Editable slug (affects platform subdomain and existing links).
- Storefront translation of UI strings into Bangla (the language setting sets `lang`
  and `og:locale`; page copy is not yet translated).

No new environment variables are required.
