# Order tracking (Phase 13)

Customer-facing order confirmation/tracking and merchant order operations.

## Public tracking

**Endpoint:** `GET /api/v1/public/stores/:storeSlug/orders/:publicReference`

**Required** query (email and/or phone — missing → `404`):

- `email` — must match shipping/billing address email (wrong → `404`)
- `phone` — must match shipping/billing phone (wrong → `404`)

Public payment initiate / retry / status endpoints use the same contact-proof rule.

### Security strategy

- Authorization is the opaque `publicReference` (32+ char high-entropy base64url from `randomBytes(24)`), scoped to an **ACTIVE** store slug, **plus** contact proof (email and/or phone).
- Sequential `orderNumber`, database UUIDs, and customer IDs are never accepted as public credentials.
- Wrong/missing email/phone returns the same `404` as a missing reference (no existence oracle).
- Short/malformed references (`< 16` chars) return `404`.
- Cross-store references return `404`.
- Inactive / suspended-tenant stores return `404`.
- Lookup is rate-limited per store + IP.
- Track-order and payment UIs always send checkout email with the reference.

### Customer-safe payload

Includes: order number, statuses (order / payment / fulfillment), money totals, shipping method snapshot, items, addresses, shipment tracking numbers, cancel reason (when cancelled), timeline.

Never includes: `internalNote`, tenant/user IDs, audit IP/UA, payment secrets, provider config.

## Timeline

Built from `AuditLog` rows for the order (and related shipment/payment entities), with gap-filling only from **real** order/payment/shipment state.

Customer-safe event types:

`ORDER_CREATED` · `ORDER_CONFIRMED` · `PAYMENT_PENDING` · `PAYMENT_PAID` · `PAYMENT_FAILED` · `PROCESSING` · `SHIPMENT_CREATED` · `SHIPPED` · `DELIVERED` · `CANCELLED`

Each event exposes: `type`, `label`, `description`, `occurredAt`.

Raw audit logs are never returned to customers.

## Cancellation

Merchant managers cancel via `PATCH /stores/:storeId/orders/:orderId/status` with `{ status: "CANCELLED", reason?: string }`.

Transactional flow:

1. Lock order row
2. Validate transition
3. Restock via SALE → RETURN movements (skip if RETURN already exists)
4. Set fulfillment `CANCELLED`; cancel unpaid payment status
5. Persist optional customer-safe `cancelReason`
6. Audit `ORDER_CANCELLED` + `ORDER_INVENTORY_RESTORED`
7. Commit

Repeated cancellation → `400`. Stock is never restored twice.

### Customer cancellation

When the store enables **Settings → Orders → Let customers cancel their own orders**, the tracking page shows a Cancel order button for eligible orders and calls `POST /public/stores/:storeSlug/orders/:publicReference/cancel` with the same email/phone proof as lookup. Only `PENDING`/`CONFIRMED`, unfulfilled, unshipped orders with no captured or in-progress online payment qualify; otherwise the API returns `422`. The same transactional restock is used, the reason is stored as `Cancelled by customer[: reason]`, and the audit entries carry `source: "customer"`. Public order payloads include `canCancel`. See [merchant-settings.md](./merchant-settings.md).

## Shipment + fulfillment

- `Shipment.status` is parcel source of truth.
- Shipping to `SHIPPED` / `IN_TRANSIT` / `DELIVERED` advances order `fulfillmentStatus` to `FULFILLED` when previously unfulfilled/partial.
- Tracking number updates audit `TRACKING_NUMBER_UPDATED`.
- Tracking numbers are plain text (max 120), escaped in UI, never executed as HTML/URLs.

## Storefront UX

- `/order-confirmation/[reference]` — confirmation + live tracking (polls every 20s until completed/cancelled/delivered)
- `/track-order` — guest lookup (reference + email)

## Merchant UX

- `/dashboard/orders` — filters (status, payment, fulfillment, shipping method, date range), search, sort (newest/oldest/highest/lowest total), pagination
- `/dashboard/orders/[orderId]` — summary, customer, items, totals, shipping, payment attempts, shipments, timeline, valid status actions, cancel with reason

## Permissions

| Action | Roles |
| --- | --- |
| Read orders / shipments / timeline | STORE_STAFF, STORE_MANAGER, tenant OWNER/ADMIN, SUPER_ADMIN |
| Write status / cancel / shipments | STORE_MANAGER (+ tenant OWNER/ADMIN elevate) |

Backend `AuthorizationService` is authoritative; UI only mirrors.
