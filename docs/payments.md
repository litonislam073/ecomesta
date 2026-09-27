# Payments (Phase 11 + Phase 12 + Phase 18 + Phase 19)

Store-scoped payment records. Offline COD/OTHER remain. Online payments use the provider architecture in [payment-providers.md](./payment-providers.md) — including **Stripe Checkout** (Phase 18) and **SSLCommerz** (Phase 19).

Public order tracking shows payment **status / provider / method** only — never secrets or provider config. See [order-tracking.md](./order-tracking.md).

## Model

`Payment` is store-scoped and order-linked:

- `internalReference` — opaque attempt id (`pay_…`)
- `attemptNumber` — increments on retry
- `provider` / `providerPaymentId`
- `method`, `status`, `amount`, `currency`
- `metadata` JSON (non-secret)

Never store card numbers, CVV, bank credentials, or payment passwords. Stripe / SSLCommerz card data stays on the hosted checkout pages.

## Merchant endpoints

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/v1/stores/:storeId/payments` | Staff+ |
| `GET` | `/api/v1/stores/:storeId/payments/:paymentId` | Staff+ |
| `PATCH` | `/api/v1/stores/:storeId/payments/:paymentId/status` | Manager+ |
| `GET/POST/PATCH/DELETE` | `/api/v1/stores/:storeId/payment-providers…` | Manager+ write |
| `POST` | `/api/v1/stores/:storeId/payment-providers/:provider/validate` | Manager+ (connectivity; no charge) |

Filters include `provider`, `status`, order number search.

## Status transitions

See [payment-providers.md](./payment-providers.md) and `payment-transitions.ts`.

Updating a payment status also updates `Order.paymentStatus`.

## Authority

Redirect/return URLs never mark `PAID`. Only verified webhooks (or trusted server verification such as SSLCommerz Order Validation) do.

## Inventory

Payment success does **not** deduct inventory again. Inventory is handled at order placement.

## Amount authority (Phase 20)

Payment initiation always uses `Order.grandTotal` (= subtotal − discount + shipping + tax) computed at placement. Adapters must not recompute shipping client-side. COD is rejected when the order’s shipping method has `codAllowed=false`.
