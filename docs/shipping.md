# Shipping (Phase 11 + Phase 20)

Store-scoped shipping methods, Bangladesh delivery zones, and server-side shipping calculation for public checkout.

## Bangladesh location hierarchy (GLOBAL)

| Model | Scope | Notes |
| --- | --- | --- |
| `BdDivision` | Global | 8 divisions |
| `BdDistrict` | Global | 64 districts |
| `BdUpazila` | Global | Substantial upazila/thana set |

- Location data is **not** store-scoped.
- Public APIs gate access behind an active store slug; merchant APIs require store membership.
- Seed: `apps/api/prisma/data/bangladesh-locations.json` (idempotent upsert by `code`).
- **SOURCE / VERSION / DATE**: see `apps/api/prisma/data/README.md` (BBS + Wikipedia BD districts/upazilas, version `2026.09.phase20`, 2026-09-26).

Location IDs (UUIDs) are used as FKs — never location names.

## Shipping zones (STORE-SCOPED)

| Model | Purpose |
| --- | --- |
| `ShippingZone` | Named zone with `priority` (higher wins) and `active` |
| `ShippingZoneLocation` | Explicit mappings: optional `divisionId` / `districtId` / `upazilaId` (at least one) |

### Matching semantics

A checkout location matches a mapping if:

1. `mapping.upazilaId` set → must equal checkout `upazilaId`
2. else `mapping.districtId` set → must equal checkout `districtId`
3. else `mapping.divisionId` set → must equal checkout `divisionId`

Among all matching **active** zones for the store, highest `priority` wins.  
**Tie-break:** newer `updatedAt`, then `name` ascending.

### Method availability

1. Resolve zone by location + priority
2. If zone found → return active methods for that `zoneId`
3. If no zone → return active methods with `zoneId` null (Phase 11 legacy / store-wide)

## Shipping methods

`ShippingMethodType`: `FLAT` | `WEIGHT_BASED` | `FREE` | `EXTERNAL`  
`ShippingProvider`: `MANUAL` | `PATHAO` | `STEADFAST` | `REDX` | `OTHER` (enum reserved; **no courier APIs** in Phase 20)

| Column | Notes |
| --- | --- |
| `zoneId` | Null = store-wide / legacy |
| `freeShippingThreshold` | When subtotal after discount ≥ threshold → amount `0` |
| `codAllowed` | Default `true`; COD checkout rejected when `false` |
| `estimatedDelivery` | Display string (e.g. `1–2 days`) |
| `sortOrder` | Ascending list order |

### Calculation (`ShippingCalculationService`)

| Type | Amount |
| --- | --- |
| `FREE` | `0.00` |
| `FLAT` / `EXTERNAL` | Configured `price` |
| `WEIGHT_BASED` | If every line has variant `weight` and `configuration.ratePerUnit` (or `ratePerKg`) → `Σ(weight×qty)×rate`; else configured `price` |

Then apply free-shipping threshold (never negative). Client shipping amounts are never trusted.

## Merchant endpoints

| Method | Path | Access |
| --- | --- | --- |
| `GET/POST` | `/api/v1/stores/:storeId/shipping-zones` | Staff read / Manager+ write |
| `GET/PATCH/DELETE` | `/api/v1/stores/:storeId/shipping-zones/:zoneId` | Staff / Manager+ |
| `GET` | `/api/v1/stores/:storeId/locations/divisions` | Staff+ |
| `GET` | `/api/v1/stores/:storeId/locations/districts?divisionId=` | Staff+ |
| `GET` | `/api/v1/stores/:storeId/locations/upazilas?districtId=` | Staff+ |
| `POST/GET/PATCH/DELETE` | `/api/v1/stores/:storeId/shipping-methods` | Staff read / Manager+ write |

`tenantId` / `storeId` are never taken from the request body as auth. Suspended store/tenant blocked via `AuthorizationService`.

## Public endpoints

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/public/stores/:storeSlug/locations/divisions` |
| `GET` | `/api/v1/public/stores/:storeSlug/locations/districts?divisionId=` |
| `GET` | `/api/v1/public/stores/:storeSlug/locations/upazilas?districtId=` |
| `GET` | `/api/v1/public/stores/:storeSlug/shipping-methods` (optional `zoneId`; prefer quote) |
| `POST` | `/api/v1/public/stores/:storeSlug/shipping/quote` |

### Quote body

```json
{
  "divisionId": "…",
  "districtId": "…",
  "upazilaId": "…",
  "items": [{ "productId": "…", "variantId": null, "quantity": 1 }],
  "couponCode": "OPTIONAL"
}
```

Server recalculates cart + coupon; returns zone info and methods with computed `amount` / `freeShippingApplied`.

## COD rule

When `paymentProvider` is `COD`, the selected shipping method must have `codAllowed=true` or checkout returns 422.

## Order shipping snapshot

At purchase, orders store:

- `shippingTotal`, `shippingMethodName`, `shippingMethodType`
- `shippingZoneName` (optional)
- Order address: `divisionId`/`districtId`/`upazilaId` plus **name snapshots** (`divisionName`, `districtName`, `upazilaName`)

Historical orders do **not** re-resolve live zone/method/location rows.

## Payments

`Order.grandTotal = subtotal − discount + shipping (+ tax)`. SSLCommerz / Stripe / COD / TEST all use server `grandTotal`.

## Audit actions

- `ZONE_CREATED` / `ZONE_UPDATED` / `ZONE_DELETED`
- `SHIPPING_METHOD_CREATED` / `UPDATED` / `DELETED`
- `SHIPMENT_CREATED` / `SHIPMENT_STATUS_CHANGED`

## Intentionally deferred

- Pathao / Steadfast / RedX / Paperfly courier API integrations
- Dimensional / distance pricing engines
- Full nationwide upazila completeness beyond seed coverage
