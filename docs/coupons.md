# Coupons + Discount Engine (Phase 14)

Store-scoped coupons with server-authoritative validation and checkout application. No loyalty, referrals, BOGO, or automatic campaigns.

## Model

| Field | Notes |
| --- | --- |
| `code` | `CITEXT`, unique per `(storeId, code)`; normalized trim + uppercase |
| `type` | Engine supports `PERCENTAGE` and `FIXED_AMOUNT` only (`FREE_SHIPPING` exists in enum but is rejected) |
| `value` | Percent (1–100) or fixed money amount |
| `active` | Inactive coupons cannot be applied to new orders |
| `startsAt` / `expiresAt` | Optional UTC windows; validated with server time |
| `usageLimit` / `usageCount` | Global redemptions; `usageCount` incremented atomically in checkout TX |
| `perCustomerLimit` | Per store-scoped identity (`customerId` or guest email on order addresses) |
| `minimumOrderAmount` | Minimum merchandise subtotal |
| `maximumDiscountAmount` | Cap on computed discount (especially useful for percentage) |

`CouponUsage` links `couponId` + `orderId` (unique), optional `customerId`, and `discountAmount`. Historical orders keep `orders.coupon_code` + `orders.discount_total` snapshots and do not depend on live coupon rows for totals.

Migration: `20260926090000_phase14_coupons` adds `coupons.per_customer_limit` and `orders.coupon_code`.

## Merchant APIs

| Method | Path | Access |
| --- | --- | --- |
| `POST` | `/api/v1/stores/:storeId/coupons` | STORE_MANAGER (+ tenant elevate / SUPER_ADMIN) |
| `GET` | `/api/v1/stores/:storeId/coupons` | store access (incl. STORE_STAFF) |
| `GET` | `/api/v1/stores/:storeId/coupons/:couponId` | store access |
| `PATCH` | `/api/v1/stores/:storeId/coupons/:couponId` | STORE_MANAGER+ |
| `DELETE` | `/api/v1/stores/:storeId/coupons/:couponId` | STORE_MANAGER+; blocked if usages exist — prefer deactivate |

Audit: `COUPON_CREATED`, `COUPON_UPDATED`, `COUPON_DEACTIVATED`, `COUPON_DELETED`, `COUPON_USED`.

## Public validation

`POST /api/v1/public/stores/:storeSlug/coupons/validate`

Body: `{ code, items: [{ productId, variantId?, quantity }] }`

Server loads ACTIVE catalog prices, computes subtotal, validates the coupon, returns:

```json
{
  "valid": true,
  "code": "SUMMER10",
  "discount": "10.00",
  "subtotal": "100.00",
  "finalSubtotal": "90.00",
  "currency": "USD"
}
```

Does **not** expose coupon id, usage counts, or merchant metadata.

## Discount math

Single source: `CouponValidationService` + `calculateCouponDiscount`.

- **Percentage**: `subtotal × value / 100`
- **Fixed**: `min(value, subtotal)`
- Apply `maximumDiscountAmount` when set
- Discount never exceeds subtotal; never negative
- Grand total: `subtotal − discount + shipping (+ tax)`

## Checkout integration

Optional `couponCode` on public checkout. Placement transaction:

1. Validate cart + live prices → subtotal
2. `SELECT … FOR UPDATE` coupon row
3. Re-check active / dates / usage / per-customer / minimum
4. Compute discount; shipping from method
5. Create order (snapshot `couponCode` + `discountTotal`)
6. Create `CouponUsage`; increment `usageCount`
7. Inventory + payment in same TX

Client-sent `discountTotal` / prices are rejected or ignored. Preview validate is advisory; checkout always re-validates under lock.

## Concurrency

`usageLimit` is enforced with row-level `FOR UPDATE` on `coupons` inside the order transaction. Two concurrent checkouts with `usageLimit = 1`: exactly one succeeds with the coupon; the other fails with a business error. `CouponUsage` unique `(couponId, orderId)` prevents duplicate usage rows for the same order.

## Per-customer limits

- Logged-in / CRM customer: count by `CouponUsage.customerId`
- Guest: count by store-scoped order address email (case-insensitive) for that coupon
- Email is **not** a global identity across stores

## Store isolation

Codes are unique per store only. Store A’s `SUMMER10` is invalid on Store B. Cart coupon state lives in `ecomesta_cart_<storeSlug>` and does not leak across stores.

## Merchant UI

- `/dashboard/coupons` — list, search, status, pagination
- `/dashboard/coupons/new` — create
- `/dashboard/coupons/[couponId]` — edit / deactivate

`useCanManageStore()` gates write actions; backend remains authoritative. STORE_STAFF is read-only.

## Security checklist

Cross-store codes, inactive/expired/future windows, usage and per-customer limits, malformed codes, percentage > 100, client money fields, archived products, empty cart, and concurrent last-use are covered by API e2e tests.
