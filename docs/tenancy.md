# Tenancy & Store Access (Phase 4)

## Hierarchy

```
User ──< TenantUser >── Tenant ──< Store
User ──< StoreUser  >── Store
```

## Membership rules

| Role | Scope | Capabilities (Phase 4) |
| --- | --- | --- |
| `SUPER_ADMIN` | Platform | Access any tenant/store via APIs; `GET /stores` stays merchant-scoped (empty unless StoreUser/OWNER/ADMIN) |
| `OWNER` / `ADMIN` | Tenant | Create stores, list members, access all stores under the tenant |
| `STAFF` | Tenant | Tenant read access; store access only with explicit `StoreUser` |
| `STORE_MANAGER` / `STORE_STAFF` | Store | Store-scoped access only |

Authorization is always resolved from the database (`tenant_users` / `store_users`), never from JWT claims alone.

## Endpoints

| Method | Path | AuthZ |
| --- | --- | --- |
| POST | `/api/v1/tenants` | Authenticated → creator becomes `OWNER` |
| GET | `/api/v1/tenants` | Membership-scoped (Super Admin: all) |
| GET | `/api/v1/tenants/:tenantId` | Tenant membership / Super Admin |
| GET | `/api/v1/tenants/:tenantId/members` | `OWNER` / `ADMIN` |
| POST | `/api/v1/tenants/:tenantId/stores` | `OWNER` / `ADMIN` → creator becomes `STORE_MANAGER` |
| GET | `/api/v1/tenants/:tenantId/stores` | Tenant access; STAFF sees only assigned stores |
| GET | `/api/v1/stores` | Stores accessible to the user |
| GET | `/api/v1/stores/:storeId` | Store access check |
| POST | `/api/v1/onboarding/store` | Authenticated atomic tenant+store bootstrap |

Clients cannot set `role`, `status`, `tenantId`, or `storeId` via create payloads.

## Onboarding transaction

`POST /onboarding/store` runs in a Prisma `$transaction`:

1. Create tenant (`ACTIVE`)
2. Create `TenantUser` (`OWNER`)
3. Create store (`DRAFT`)
4. Create `StoreUser` (`STORE_MANAGER`)

Any failure rolls back the entire unit. Slug conflicts return `409`.

## IDOR protection

Every tenant/store read or write path:

1. Authenticates the user
2. Loads memberships from Postgres
3. Denies with `403` / `404` when unauthorized

Changing path params (`tenantId`, `storeId`) or body fields cannot escalate privileges.

## Audit

Sensitive creates emit `AuditLog` rows:

- `TENANT_CREATED`
- `STORE_CREATED`

No secrets are stored in metadata.
