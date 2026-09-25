# Customers (Phase 6A)

Store-scoped merchant APIs for customers and addresses.

Base path: `/api/v1/stores/:storeId/customers`

## Models

### Customer

| Field | Notes |
| --- | --- |
| `storeId` | Owning store (from URL + auth) |
| `email` | Optional, CITEXT, unique per store when present |
| `phone` | Optional, unique per store when present |
| `firstName` / `lastName` | Required on create |
| `notes` | Optional merchant notes |

No customer status/archive column exists in Phase 2. Soft-delete was not invented for this phase.

### CustomerAddress

| Field | Notes |
| --- | --- |
| `customerId` | Parent customer |
| `type` | `BILLING` \| `SHIPPING` |
| Address lines, city, state, postalCode, country (ISO-2), phone | Validated on write |

Cascade: deleting a customer deletes addresses. Orders set `customerId` to null on customer delete (schema `onDelete: SetNull`), but the API **rejects** delete when orders or coupon usages exist.

## Deletion strategy

1. If the customer has any `Order` or `CouponUsage` rows → **409 Conflict**
2. Otherwise hard-delete the customer (addresses cascade)

## Authorization

| Action | Role |
| --- | --- |
| Read | Store access (`STORE_STAFF+`, tenant OWNER/ADMIN, Super Admin) |
| Create / update / delete customer & addresses | `STORE_MANAGER` (or elevated) |

## Endpoints

### Customers

- `POST /api/v1/stores/:storeId/customers`
- `GET /api/v1/stores/:storeId/customers` (`search`, `email`, `phone`, `createdFrom`, `createdTo`, sort, pagination)
- `GET /api/v1/stores/:storeId/customers/:customerId` (includes `addresses`)
- `PATCH /api/v1/stores/:storeId/customers/:customerId`
- `DELETE /api/v1/stores/:storeId/customers/:customerId`

### Addresses

- `POST /api/v1/stores/:storeId/customers/:customerId/addresses`
- `GET /api/v1/stores/:storeId/customers/:customerId/addresses`
- `GET /api/v1/stores/:storeId/customers/:customerId/addresses/:addressId`
- `PATCH .../addresses/:addressId`
- `DELETE .../addresses/:addressId`

## Store isolation

Every query includes `storeId` from the authorized URL path. Cross-store customer/address IDs return **403** (no store access) or **404** (resource not in store).

## Audit actions

`CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `CUSTOMER_DELETED`, `CUSTOMER_ADDRESS_CREATED`, `CUSTOMER_ADDRESS_UPDATED`, `CUSTOMER_ADDRESS_DELETED`
