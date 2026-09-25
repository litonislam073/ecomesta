# Public Checkout (Phase 10)

Guest checkout places real orders through the Phase 8 order pipeline. No payment gateways.

## Flow

1. Customer fills `/checkout` from the store-scoped cart
2. Browser sends product/variant IDs + quantities only (no prices)
3. `POST /api/v1/public/stores/:storeSlug/checkout` with `Idempotency-Key`
4. Server resolves ACTIVE store, validates ACTIVE catalog, prices from DB, locks inventory
5. Creates Order + OrderItems (snapshots) + OrderAddresses + Payment (`PENDING`)
6. Response includes `orderNumber` + opaque `publicReference`
7. Storefront clears that store’s cart and opens `/order-confirmation/[reference]`

## Public APIs

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/public/stores/:storeSlug/checkout` | Requires `Idempotency-Key` |
| GET | `/api/v1/public/stores/:storeSlug/orders/:publicReference` | Optional `?email=` match |

Client must not send unit prices, subtotals, shipping totals, payment status, or order status. Extra money fields are rejected by DTO whitelist.

## Server-side pricing

- Unit price = product `basePrice` or variant `price` at commit time
- `subtotal` = Σ (unitPrice × quantity)
- `shippingTotal` = **0** in Phase 10 (no shipping engine yet)
- `discountTotal` = 0
- `grandTotal` = subtotal + shipping − discount
- Arithmetic uses `Prisma.Decimal`

## Inventory transaction

Shared `OrderPlacementService.place()` (also used by merchant create):

1. Begin Prisma transaction
2. Allocate `EM-{sequence}` under store row update
3. Load/validate lines (ACTIVE only for public)
4. `SELECT … FOR UPDATE` inventory rows
5. Deduct quantity; write `SALE` movements
6. Create order, items, addresses, payment
7. Commit — any failure rolls back everything

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
- Optional email query must match a snapshot address email

## Guest checkout

- No customer login
- Contact + shipping (billing optional / same-as-shipping)
- `customerId` left null; emails live on `OrderAddress`

## Payment methods (offline only)

Allowed providers: `COD`, `OTHER`  
Allowed methods: `CASH`, `BANK_TRANSFER`, `OTHER`  

Payment status is always initialized as `PENDING`. COD is never marked `PAID` at checkout.

## Future gateway integration

Later phases may add Stripe / bKash / SSLCommerz as `PaymentProvider` values with separate authorization capture. Checkout should keep server-side pricing and idempotency unchanged.
