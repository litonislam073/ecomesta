# Courier integrations (V1: Steadfast)

Merchants connect a courier in **Settings → Couriers**, then book a parcel from
an order (**Orders → order → Shipments → Create shipment**) and refresh its
delivery status with **Sync status**.

## Architecture

| Piece | Where |
|---|---|
| Provider contract (`createShipment`, `getShipmentStatus`, `describeStatus`, `validateCredentials`, `trackingUrl`, `supportsCancellation`) | `apps/api/src/modules/couriers/courier-provider.ts` |
| Steadfast implementation + HTTP client + status map | `couriers/providers/steadfast/` |
| Registry (add Pathao / RedX / Paperfly here) | `couriers/courier-provider.registry.ts` |
| Connections (encrypted credentials) | `couriers/courier-connections.service.ts` |
| Booking + status sync | `couriers/courier-shipments.service.ts` |
| Shipment → order fulfillment (shared with manual shipments) | `shipments/shipment-fulfillment.ts` |

A courier booking is an ordinary `Shipment` row (`provider = STEADFAST`) with
courier fields: `provider_reference` (what we sent as `invoice`),
`provider_shipment_id` (`consignment_id`), `provider_status` (raw
`delivery_status`), `cod_amount`, `weight_kg`, `last_synced_at`. Status history
is in `shipment_events`. The `ShippingProvider` enum already listed STEADFAST,
PATHAO and REDX.

## API

| Method | Path | Role |
|---|---|---|
| GET | `/stores/:storeId/couriers` | store member — couriers and connection status, never credentials |
| PUT | `/stores/:storeId/couriers/:provider` | manager — connect/update; keys are write-only, checked with a read-only call first |
| DELETE | `/stores/:storeId/couriers/:provider` | manager — deletes the stored credentials |
| POST | `/stores/:storeId/orders/:orderId/courier-shipments` | manager — `{provider, weightKg?, note?}`; no amount is accepted |
| POST | `/stores/:storeId/orders/:orderId/shipments/:shipmentId/sync` | manager — refresh status from the courier (409 while the booking call is still running) |
| POST | `/stores/:storeId/orders/:orderId/shipments/:shipmentId/release` | manager — mark an *unconfirmed* booking as not booked after checking the courier account |
| GET | `/stores/:storeId/orders/:orderId/shipments/:shipmentId` | store member — shipment + status history |

Courier-booked shipments cannot be edited with the manual shipment PATCH
(`409 SHIPMENT_MANAGED_BY_COURIER`). While an order has an active courier
booking (booked, in progress or unconfirmed): manual "Create shipment" is
`409 SHIPMENT_ALREADY_EXISTS`, and cancelling the order is
`409 ORDER_HAS_ACTIVE_COURIER_SHIPMENT` (Steadfast cannot be told to cancel
the parcel; cancel it with Steadfast first — once the shipment is
CANCELLED/RETURNED the order can be cancelled). A courier booking is likewise
refused while a manual shipment is active. Both take the same order-row lock.

## Steadfast API contract

Verified against Steadfast's own code (no public reference page exists):
SteadFast Courier LTD's WordPress plugin `steadfast-api` v1.0.9 and the
`steadfast-it/SteadFast-Courier-Laravel-Package`.

- Base URL `https://portal.packzy.com/api/v1` (override with `STEADFAST_BASE_URL`, server env only; must be public https in production).
- Auth headers `Api-Key`, `Secret-Key`; `Content-Type: application/json`.
- `POST /create_order` `{invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note}` →
  `{status: 200, consignment: {consignment_id, invoice, tracking_code, status}}`; validation errors
  `{status: 400, errors: {field: [message]}}`.
- `GET /status_by_cid/{id}`, `/status_by_invoice/{invoice}`, `/status_by_trackingcode/{code}` → `{status: 200, delivery_status}`.
- `GET /get_balance` → `{status: 200, current_balance}` — used only to check credentials.
- Phone: 11 digits starting `0` (we normalise `+880…`, `880…`, missing `0`; anything else is refused).

**Not offered**, because Steadfast documents no such thing: cancellation
(`supportsCancellation = false`, no button), a public tracking URL
(`trackingUrl = null`; the tracking code is shown with a Copy button), weight
or pickup fields in `create_order` (weight is kept on the shipment; pickup
details are for the merchant's team — Steadfast uses the pickup address in the
merchant's Steadfast account). Webhooks exist (Bearer token) but V1 uses manual
sync. No rate limits are documented; HTTP 429 is handled.

## Status mapping

| Steadfast `delivery_status` | Shipment status |
|---|---|
| `in_review`, `pending` | `LABEL_CREATED` (booked; Steadfast does not report pickup/transit) |
| `delivered`, `delivered_approval_pending` | `DELIVERED` |
| `cancelled`, `cancelled_approval_pending` | `CANCELLED` (`RETURNED` if it had already shipped) |
| `hold`, `partial_delivered*`, `unknown*`, anything else | unchanged (raw status stored and shown) |

A shipment never moves backwards or out of CANCELLED/RETURNED/FAILED. DELIVERED
advances order fulfillment to FULFILLED (same one-way rule as manual
shipments). **Order status and payment status are never changed by a courier.**

## Booking rules

- COD is computed on the server: `PAID` → 0; `PENDING` with a cash-on-delivery
  payment → the order total; anything else (online payment not complete,
  partial, refunded…) → `422 ORDER_NOT_SHIPPABLE`.
- Steadfast documents `cod_amount` as an integer (whole taka). Ecomesta stores
  money as `Decimal(12,2)`, so a total can carry paisa. A whole-taka amount is
  sent exactly (`1250.00` → `1250`); a total with paisa is **refused, not
  rounded** (`422 COURIER_COD_NOT_WHOLE_TAKA`, nothing sent to Steadfast) —
  rounding would make the courier collect a different amount from the order
  total. Ship such an order manually. Only the request payload is converted:
  the order total, payments and the shipment's `cod_amount` keep two decimals.
- Refused: cancelled/draft/completed orders, fulfilled orders, orders with an
  active shipment, invalid phone, store without a connected courier.
- **Duplicate safety never relies on Steadfast.** Steadfast does not reject a
  repeated `invoice` — its own README shows two parcels created with the same
  invoice — and it documents no "not found" answer for the status endpoints.
  So:
  - The shipment row (with `provider_reference = {store-slug}-{orderNumber}[-n]`,
    sent as `invoice`) is written under the order lock *before* Steadfast is
    called; a partial unique index allows one active courier booking per order.
  - A refused request (validation, credentials, 429) removes the row.
  - A lost answer (timeout, network, 5xx, unreadable) leaves it `unconfirmed`.
    **`create_order` is never called again for it.** "Create shipment" and
    "Sync status" only call `GET /status_by_invoice/{invoice}`: a documented
    `{status: 200, delivery_status}` answer recovers the booking (tracking code
    is not part of that answer, so it stays empty); anything else — including
    a 404-looking answer, a timeout or a 5xx — keeps it unconfirmed.
  - Only the merchant, after checking their Steadfast account, can **Mark as
    not booked** (`/release`): Steadfast is asked once more (a confirmed parcel
    is recovered instead), then the booking is closed as FAILED and the next
    booking uses a new invoice (`…-2`). Releasing while the parcel does exist
    in Steadfast would create a second parcel — the dialog says so.
  - Sync and release refuse (409) a booking whose create call is still
    running; a call older than 2 minutes (process stopped mid-call) is treated
    as unconfirmed.
- Ecomesta's `Idempotency-Key` header is not used for courier calls; Steadfast
  documents no idempotency mechanism.

## Security

- Credentials: AES-256-GCM via `PaymentSecretsCryptoService`
  (`PAYMENT_SECRETS_ENCRYPTION_KEY`), never returned, never logged (request
  bodies are not logged; audit metadata records only `credentialsChanged`),
  never in URLs; errors shown to merchants never include them.
- Every query is scoped by `store_id`; other merchants get 403/404.

## Rolling back the migration

`20261007090000_courier_integration` is additive. To remove it (drops courier
data only):

```sql
BEGIN;
DROP INDEX IF EXISTS "shipments_one_active_courier_booking_per_order";
DROP INDEX IF EXISTS "shipments_provider_shipment_id_key";
DROP INDEX IF EXISTS "shipments_provider_reference_key";
DROP TABLE IF EXISTS "shipment_events";
DROP TABLE IF EXISTS "courier_connections";
ALTER TABLE "shipments"
  DROP COLUMN IF EXISTS "cod_amount",
  DROP COLUMN IF EXISTS "last_synced_at",
  DROP COLUMN IF EXISTS "provider_reference",
  DROP COLUMN IF EXISTS "provider_shipment_id",
  DROP COLUMN IF EXISTS "provider_status",
  DROP COLUMN IF EXISTS "weight_kg";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261007090000_courier_integration';
COMMIT;
```

Deploy the previous release's code first; the old code does not read these
columns.
