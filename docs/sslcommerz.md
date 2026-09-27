# SSLCommerz (Phase 19)

Bangladesh hosted checkout via the official SSLCommerz **v4** APIs.

## Critical rule

**The Order Validation API is authoritative.** Browser `success_url` / `fail_url` / `cancel_url` redirects are informational only — they must never mark a payment `PAID`.

Authoritative path:

1. Customer pays on SSLCommerz hosted page
2. SSLCommerz POSTs an **IPN** to Ecomesta
3. Ecomesta calls the **Order Validation API** with `val_id` + store credentials
4. Only `VALID` / `VALIDATED` validation responses mark the payment `PAID`

## Endpoints (mode-selected)

| Mode | Session init (POST form-urlencoded) | Order Validation (GET) |
| --- | --- | --- |
| `test` | `https://sandbox-gw.sslcommerz.com/gwprocess/v4/api.php` | `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php` |
| `live` | `https://securepay.sslcommerz.com/gwprocess/v4/api.php` | `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php` |

Official docs: [developer.sslcommerz.com/doc/v4](https://developer.sslcommerz.com/doc/v4/) and [sandbox-gw.sslcommerz.com/docs](https://sandbox-gw.sslcommerz.com/docs).

## Secrets shape

```json
{ "storeId": "…", "storePassword": "…" }
```

Encrypted at rest. Never returned in API responses, logs, audit metadata, or the merchant UI after save. Mapped to SSLCommerz `store_id` / `store_passwd` only for outbound server calls.

## Session initiation

- `tran_id` = payment `internalReference` (≤ 30 chars)
- `total_amount` = `Order.grandTotal` formatted as decimal `10,2` (`toFixed(2)`)
- `currency` = order currency (BDT preferred)
- BDT minimum **10.00** (official); amounts below that are rejected with HTTP 400
- `ipn_url` = `{API_URL}/api/v1/public/payment-webhooks/SSL_COMMERZ`
- `success_url` / `fail_url` / `cancel_url` from storefront return URLs
- Optional metadata: `value_a` = paymentId, `value_b` = storeId (not auth)
- Response: `status=SUCCESS` + `GatewayPageURL` + `sessionkey` → redirect + `providerPaymentId`

## IPN + validation

Webhook: `POST /api/v1/public/payment-webhooks/SSL_COMMERZ` (often form-urlencoded).

| IPN `status` | Behavior |
| --- | --- |
| `FAILED` | → payment `FAILED` (no validation call) |
| `CANCELLED` | → payment `CANCELLED` (no validation call) |
| `VALID` (with `val_id`) | Call Order Validation API; `VALID`/`VALIDATED` → `PAID` |
| `INVALID_TRANSACTION` (validation) | Reject (unauthorized) |

Event id: prefer `val_id`, else `tran_id:status:bank_tran_id`. Amount from validation is compared to the payment amount by orchestration.

Security is **store credentials + Order Validation API** (no Stripe-style signature header).

## Merchant config

`/dashboard/settings/payments` → SSLCommerz form: store ID, store password (masked), sandbox/live, enable, save, test connection.

Validate: session API with amount `10.00` and a unique throwaway `tran_id`. Success + `GatewayPageURL` → ok. Invalid store → HTTP 422.

## Related

- [payment-providers.md](./payment-providers.md)
- [payments.md](./payments.md)
- [checkout.md](./checkout.md)
