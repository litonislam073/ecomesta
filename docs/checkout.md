# Public Checkout (Phase 10–14)

Guest checkout places real orders through the Phase 8 order pipeline. Coupons are Phase 14 — see [coupons.md](./coupons.md). Online adapters: TEST, Stripe, SSLCommerz.

## Flow

1. Customer fills `/checkout` from the store-scoped cart (optional coupon apply)
2. Contact → **Division / District / Upazila** → Address → **Shipping quote** → Payment → Review → Place order
3. Browser sends product/variant IDs + quantities + location IDs + `shippingMethodId` + optional `couponCode` (no prices)
4. `POST /api/v1/public/stores/:storeSlug/checkout` with `Idempotency-Key`
5. Server resolves ACTIVE store, zone + active shipping method, ACTIVE catalog, prices from DB, locks inventory + coupon
6. Creates Order + OrderItems (snapshots) + OrderAddresses (incl. BD name snapshots) + Payment + shipping snapshot + optional CouponUsage
7. Response includes `orderNumber` + opaque `publicReference` + discount snapshot
8. Storefront clears that store’s cart and opens `/order-confirmation/[reference]`

## Public APIs

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/public/stores/:storeSlug/locations/divisions` | BD hierarchy (active store) |
| GET | `/api/v1/public/stores/:storeSlug/locations/districts?divisionId=` | Cascading |
| GET | `/api/v1/public/stores/:storeSlug/locations/upazilas?districtId=` | Cascading |
| GET | `/api/v1/public/stores/:storeSlug/shipping-methods` | Active methods; prefer quote |
| POST | `/api/v1/public/stores/:storeSlug/shipping/quote` | Server-priced methods for location + cart |
| POST | `/api/v1/public/stores/:storeSlug/coupons/validate` | Preview discount from live catalog prices |
| POST | `/api/v1/public/stores/:storeSlug/checkout` | Requires `Idempotency-Key` + `shippingMethodId`; optional `couponCode` + location IDs |
| POST | `/api/v1/public/stores/:storeSlug/orders/:publicReference/lookup` | Body `{ email }` or `{ phone }`; see [order-tracking.md](./order-tracking.md) |
| GET | `/api/v1/public/stores/:storeSlug/orders/:publicReference` | Same with `?email=` / `?phone=` (API clients; puts the contact in the URL) |

Client must not send unit prices, subtotals, shipping totals, discounts, payment status, or order status. Extra money fields are rejected by DTO whitelist. Coupon codes are re-validated under lock at placement.

After checkout the storefront opens `/order-confirmation/[reference]?store=…` — without the customer's phone or email, which the tab keeps in `sessionStorage` (see [order-tracking.md](./order-tracking.md#contact-details-never-go-in-urls)). Guests can also use `/track-order` (reference + phone or email).

## Server-side pricing

- Unit price = product `basePrice` or variant `price` at commit time
- `subtotal` = Σ (unitPrice × quantity)
- `discountTotal` = server coupon math when `couponCode` present (else 0)
- `shippingTotal` = server zone + method calculation (see [shipping.md](./shipping.md)); free threshold uses subtotal after discount
- `grandTotal` = subtotal − discount + shipping (+ tax)
- Arithmetic uses `Prisma.Decimal`
- Order stores `shippingMethodName` + `shippingMethodType` + `shippingZoneName` + `couponCode` snapshots
- COD requires selected method `codAllowed=true`

## Inventory transaction

Shared `OrderPlacementService.place()` (also used by merchant create):

1. Begin Prisma transaction
2. Allocate `EM-{sequence}` under store row update
3. Load/validate lines (ACTIVE only for public) → subtotal
4. Lock coupon (`FOR UPDATE`) when `couponCode` set; compute discount
5. `SELECT … FOR UPDATE` inventory rows
6. Deduct quantity; write `SALE` movements
7. Create order, items, addresses, payment, CouponUsage + `usageCount++`
8. Commit — any failure rolls back everything

## Idempotency

- Header: `Idempotency-Key`
- Stored on `orders.idempotency_key` unique per `(store_id, idempotency_key)`
- Replay returns the same public confirmation (`meta.replayed: true`)
- Concurrent duplicates resolve via unique constraint + re-fetch

## Rate limiting

Redis fixed-window via `RedisRateLimitService`: **30 checkout attempts / 60s / store+IP**. HTTP 429 when exceeded.

## Public order reference

- `public_reference`: 24-byte `base64url` token (unguessable)
- Confirmation URLs use this token, not sequential `orderNumber` or UUID
- Lookups need the checkout email or phone (request body); it must match a snapshot address

## Guest checkout

- No customer login
- Contact + shipping (billing optional / same-as-shipping)
- `customerId` left null; emails live on `OrderAddress`
- Email and shipping address are always required
- Phone is optional unless the store enables **Require a phone number** (`checkoutRequirePhone`); the API then rejects orders without a contact or shipping phone
- Order notes are accepted unless the store turns them off (`checkoutAllowOrderNotes`), in which case `customerNote` is dropped

## Payment methods (offline + optional online)

Offline providers: `COD`, `OTHER`  
Offline methods: `CASH`, `BANK_TRANSFER`, `OTHER`  

Online (when configured): `TEST`, `STRIPE`, or `SSL_COMMERZ` with method `CARD`. Stripe and SSLCommerz use hosted checkout. See [payment-providers.md](./payment-providers.md) and [sslcommerz.md](./sslcommerz.md).

Online flow:

1. Create order (server totals + inventory)
2. `POST …/payments/create` (amount from `Order.grandTotal`)
3. Redirect to provider / continue page
4. Verified webhook (and SSLCommerz Order Validation) updates payment status
5. Return pages poll server status only (never mark paid)

Payment status is always initialized as `PENDING`. COD is never marked `PAID` at checkout.
