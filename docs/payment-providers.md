# Payment Providers (Phase 12 + Phase 18 + Phase 19)

Provider-agnostic online payment architecture. Offline COD/OTHER remain unchanged.

## Critical rule

**Never mark a payment `PAID` because:**

- the customer returned from a gateway redirect
- the frontend says success
- a query parameter says paid

Payment becomes authoritative only after:

1. a **verified provider webhook**, or
2. a **trusted server-side provider verification API**

Redirect pages (`/payment/success|cancel|failure|continue`) are informational and poll server status only.

For SSLCommerz, the trusted verification step is the **Order Validation API** after IPN — see [sslcommerz.md](./sslcommerz.md).

## Provider abstraction

Location: `apps/api/src/modules/payments/providers/`

```ts
interface PaymentGatewayAdapter {
  code: PaymentProvider;
  createPayment(input): Promise<{ providerPaymentId, redirectUrl, clientPayload? }>;
  verifyWebhook(input): Promise<VerifiedWebhookEvent>;
}
```

Registry selects adapters by `PaymentProvider`. Offline providers (`COD`, `OTHER`) do not use adapters for initiation.

## Implemented providers

| Provider | Status |
| --- | --- |
| `COD` / `OTHER` | Offline (Phase 10/11) |
| `TEST` | Deterministic online adapter for local + automated tests |
| `STRIPE` | Hosted Stripe Checkout (Phase 18) |
| `SSL_COMMERZ` | Hosted SSLCommerz v4 (Phase 19) |
| `BKASH` / `NAGAD` | Enum reserved — **not implemented** |

No fabricated real-gateway API behavior for unimplemented providers.

### TEST provider

- Create payment → redirect to `/payment/continue?ref=...`
- Webhook header: `x-ecomesta-test-signature`
- Signature: `HMAC-SHA256(rawBody, secrets.webhookSecret)` hex
- Body JSON: `{ eventId, eventType, internalReference, status, amount?, providerPaymentId? }`

### STRIPE provider (Phase 18)

- Create payment → Stripe Checkout Session (`mode: payment`)
- Amount converted from `Decimal` to integer **cents** safely (no float drift)
- Metadata: `ecomestaInternalReference`, `orderId`, `storeId`, `paymentId`
- `client_reference_id` = internal payment reference
- Returns `session.id` as `providerPaymentId` + hosted `url`
- Secrets: `{ secretKey, webhookSecret }` (encrypted at rest; never returned)
- Webhook: `stripe-signature` + `constructEvent`
- Event mapping:
  - `checkout.session.completed` with `payment_status === paid` → `PAID`
  - `payment_intent.succeeded` → `PAID`
  - `payment_intent.payment_failed` → `FAILED`
- Optional validate: `POST …/payment-providers/STRIPE/validate` calls `balance.retrieve` (no charge)
- Webhook peek resolves nested Stripe Event: `data.object.client_reference_id`, `metadata.ecomestaInternalReference`, or `data.object.id`

### SSL_COMMERZ provider (Phase 19)

- Create payment → SSLCommerz v4 session (`GatewayPageURL` redirect)
- Secrets: `{ storeId, storePassword }` (never logged/returned)
- `tran_id` = payment `internalReference`; `providerPaymentId` = `sessionkey`
- IPN at `/public/payment-webhooks/SSL_COMMERZ` (JSON or form-urlencoded)
- **PAID only after Order Validation API** returns `VALID` / `VALIDATED`
- BDT minimum amount 10.00; validate connectivity via session init with 10.00
- Details: [sslcommerz.md](./sslcommerz.md)

## Configuration

`PaymentProviderConfig` per store + provider:

- `enabled`, `mode` (`test`|`live`)
- `publicConfig` JSON (safe to return)
- `encryptedSecrets` AES-256-GCM ciphertext (never returned)

Merchant APIs:

- `GET/POST /stores/:storeId/payment-providers`
- `PATCH/DELETE /stores/:storeId/payment-providers/:provider`
- `POST /stores/:storeId/payment-providers/:provider/validate`

Writable online providers: `TEST`, `STRIPE`, `SSL_COMMERZ`. Write: manager+. Secrets never appear in responses, logs, audit metadata, or admin console.

## Secret storage

Env: `PAYMENT_SECRETS_ENCRYPTION_KEY` (64-char hex preferred; otherwise SHA-256 derived).

Algorithm: AES-256-GCM (`v1:iv:tag:ciphertext` base64url).

## Payment initiation

`POST /public/stores/:storeSlug/payments/create`

1. Resolve ACTIVE store + order by `publicReference`
2. Amount = `Order.grandTotal` only (reject client amounts)
3. Require enabled provider config
4. Create/reuse PENDING attempt with `internalReference` (`pay_…`)
5. Call adapter `createPayment`
6. Return redirect URL

Inventory is **not** touched on payment success (already deducted at order placement).

## Webhooks

`POST /public/payment-webhooks/:provider`

- No merchant JWT
- Raw body + provider verification (signature and/or validation API)
- Idempotent via `PaymentWebhookEvent` unique `(provider, eventId)`
- Duplicate events return success without re-applying status
- Peek helpers resolve JSON and form-urlencoded bodies (`tran_id` for SSLCommerz)

## State machine

Uses existing `PaymentStatus` transitions (`payment-transitions.ts`). Syncs `Order.paymentStatus` from the authoritative payment update path.

Failed online payment → `FAILED`; order stays; inventory not auto-restocked (cancel remains explicit order lifecycle).

## Retry

`POST /public/stores/:storeSlug/payments/retry`

Creates a **new attempt** on the same order after `FAILED`/`CANCELLED`. Does not create a new order. Does not reuse a `PAID` attempt. Public UI retries with the payment’s current provider (not hardcoded).

## Public listing

`GET /public/stores/:storeSlug/payment-providers` → offline options + enabled online providers (no secrets).

## Future real providers

Add an adapter under `providers/<name>/`, register it, allow config upsert for that enum value. Keep initiation/webhook/idempotency services unchanged.
