# Orders (Phase 8–14)

Store-scoped order management. Merchant create remains authenticated. **Public guest checkout** places orders through `OrderPlacementService` — see [checkout.md](./checkout.md). Coupons snapshot onto the order — see [coupons.md](./coupons.md). Customer tracking and merchant operations are documented in [order-tracking.md](./order-tracking.md).

Payment **gateways** and courier APIs remain out of scope. See [shipping.md](./shipping.md) and [payments.md](./payments.md).

## Architecture

```
Merchant UI / API client
  → POST|GET|PATCH /api/v1/stores/:storeId/orders*
  → OrdersService (AuthorizationService + Prisma transaction)
  → Order + OrderItem snapshots + OrderAddress
  → InventoryItem FOR UPDATE + InventoryMovement (SALE / RETURN)
  → Payment + optional Shipment foundation
  → AuditLog → customer-safe OrderTimeline
```

## Endpoints

| Method | Path | Access |
| --- | --- | --- |
| `POST` | `/stores/:storeId/orders` | STORE_MANAGER (+ tenant elevate) |
| `GET` | `/stores/:storeId/orders` | store access (filters: status, payment, fulfillment, shippingMethod, dates, search, sort) |
| `GET` | `/stores/:storeId/orders/:orderId` | store access (includes timeline, publicReference, cancelReason) |
| `PATCH` | `/stores/:storeId/orders/:orderId/status` | STORE_MANAGER (`reason` optional on CANCELLED) |
| `PATCH` | `/stores/:storeId/orders/:orderId/payment-status` | STORE_MANAGER |
| `PATCH` | `/stores/:storeId/orders/:orderId/fulfillment-status` | STORE_MANAGER |

`storeId` / `tenantId` / roles in the body are ignored (whitelist / forbidNonWhitelisted).

## Order lifecycle

```
DRAFT → PENDING | CANCELLED
PENDING → CONFIRMED | CANCELLED
CONFIRMED → PROCESSING | CANCELLED
PROCESSING → COMPLETED | CANCELLED
COMPLETED / CANCELLED → terminal
```

Invalid transitions → `422`.

## Inventory behavior

On create (atomic transaction):

1. Allocate order number via `stores.order_sequence` update (`RETURNING`)
2. Validate same-store products/variants/customer/addresses
3. Snapshot prices/names into `OrderItem`
4. `SELECT … FOR UPDATE` inventory rows (sorted keys)
5. Reject insufficient available stock (`quantity - reserved`)
6. Decrement on-hand; write `InventoryMovement` type `SALE` (`quantity` negative), `referenceType=ORDER`
7. Create order, addresses, payment row

On cancel (`status → CANCELLED`):

1. Lock order row
2. Restock using SALE movements → `RETURN` movements once
3. Second cancel rejected (already CANCELLED)

## Concurrency strategy

PostgreSQL row locks on inventory (+ store sequence update). Concurrent last-unit purchase: one `201`, one `422`; stock never negative.

## Order number strategy

Per-store monotonic counter `order_sequence` (default 100000).

Format: `EM-{sequence}` (unique on `(storeId, orderNumber)`).

## Snapshots

- `OrderItem`: productName, variantName, sku, unitPrice, totalPrice, quantity
- `OrderAddress`: shipping + billing copies (optional `email` for guests)
- Totals: Prisma `Decimal(12,2)` — subtotal − discount + shipping + tax
- Discount: `discountTotal` + optional `couponCode` (historical; independent of live Coupon row)

## Payment / fulfillment foundation

Internal status only. Creates a `Payment` row at order time (default COD/CASH). Fulfillment may create a MANUAL `Shipment` stub. **No** Stripe/PayPal/bKash/courier APIs.

## Merchant UI

- `/dashboard/orders` — list, search, filters, pagination
- `/dashboard/orders/[orderId]` — detail, status controls, cancel

Manual `/dashboard/orders/new` is deferred (API supports create; next merchant item).

## Known future work

- Public checkout / cart
- Gateway payments & refunds
- Loyalty / referral / automatic promotion engines (Phase 14 covers store coupons only)
- Courier tracking
- Manual merchant order composer UI
