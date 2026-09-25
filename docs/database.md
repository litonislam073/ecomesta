# Ecomesta Database

Phase 2 relational foundation for the multi-tenant SaaS ecommerce platform.

## Hierarchy

```
Platform (Super Admin)
  └── Tenant (merchant organization)
        ├── TenantUser (membership + tenant role)
        ├── Subscription → SubscriptionPlan
        └── Store
              ├── StoreUser (membership + store role)
              ├── Product → ProductVariant
              ├── Category (nested via parentId)
              ├── ProductCategory (M2M)
              ├── InventoryItem / InventoryMovement
              ├── Customer → CustomerAddress
              ├── Order → OrderItem / OrderAddress
              ├── Payment
              ├── ShippingMethod / Shipment
              ├── Coupon → CouponUsage
              ├── Media
              ├── StoreTheme → Theme
              └── Domain
```

## Multi-tenant isolation

- Tenant-scoped tables carry `tenant_id`.
- Store-scoped tables carry `store_id` **directly** (not only via joins).
- Backend services must filter by authenticated `tenantId` / `storeId`.
- Super Admin is platform-scoped (`users.platform_role = SUPER_ADMIN`) and is not limited to a single tenant.

## Major models

| Model | Purpose |
| --- | --- |
| `User` | Platform identity; password stored as `password_hash` only (Argon2id) |
| `AuthSession` | Refresh-token sessions; stores SHA-256 `token_hash`, never raw tokens |
| `Tenant` | Merchant/business organization |
| `Store` | Online store under a tenant (`tenant_id + slug` unique) |
| `TenantUser` | Tenant membership (`tenant_id + user_id` unique) |
| `StoreUser` | Store access (`store_id + user_id` unique) |
| `Product` | Catalog item scoped to a store |
| `ProductVariant` | Optional variants; `store_id` denormalized for isolation/SKU queries |
| `Category` | Nested categories via `parent_id` |
| `ProductCategory` | Product ↔ category M2M |
| `InventoryItem` | Stock levels (product and/or variant) |
| `InventoryMovement` | Append-only stock movement history |
| `Customer` | Store-scoped customer profile |
| `CustomerAddress` | Billing/shipping addresses |
| `Order` | Store-scoped order header |
| `OrderItem` | Line items with **price/name snapshots** |
| `OrderAddress` | Address snapshot at checkout time |
| `Payment` | Payment attempts/records for an order |
| `ShippingMethod` | Configured shipping options |
| `Shipment` | Fulfillment shipments |
| `Coupon` / `CouponUsage` | Promotions and usage tracking |
| `Media` | Object-storage metadata |
| `Theme` / `StoreTheme` | Theme catalog and per-store activation |
| `Domain` | Globally unique hostname → store mapping |
| `SubscriptionPlan` / `Subscription` | SaaS billing foundation (tenant-level) |
| `AuditLog` | Security/admin audit trail |
| `Notification` | In-app notifications |
| `HealthProbe` | Phase 1 connectivity probe (retained) |

## Important unique constraints

| Constraint | Meaning |
| --- | --- |
| `users.email` | Globally unique identity |
| `tenants.slug` | Globally unique tenant slug |
| `stores(tenant_id, slug)` | Store slug unique per tenant |
| `tenant_users(tenant_id, user_id)` | One membership per tenant |
| `store_users(store_id, user_id)` | One membership per store |
| `products(store_id, slug)` | Product slug unique per store |
| `categories(store_id, slug)` | Category slug unique per store |
| `orders(store_id, order_number)` | Order number unique per store |
| `coupons(store_id, code)` | Coupon code unique per store |
| `domains.hostname` | One hostname → one store |
| `themes.slug` / `subscription_plans.slug` | Global catalog uniqueness |
| `media(store_id, key)` | Object key unique per store |
| `coupon_usages(coupon_id, order_id)` | One usage record per coupon/order |
| Inventory / SKU partial uniques | See migration SQL (`NULLS NOT DISTINCT` / partial indexes) |

## Roles

| Layer | Enum | Values |
| --- | --- | --- |
| Platform | `PlatformRole` | `USER`, `SUPER_ADMIN` |
| Tenant | `TenantRole` | `OWNER`, `ADMIN`, `STAFF` |
| Store | `StoreRole` | `STORE_MANAGER`, `STORE_STAFF` |

Authorization enforcement belongs in NestJS services/guards (later phases).

## Delete / cascade strategy

| Relationship | Strategy | Why |
| --- | --- | --- |
| Tenant/Store memberships | `Cascade` | Memberships disappear with parent |
| Orders / Payments / Shipments / Movements | `Restrict` | Preserve financial/history integrity |
| OrderItem → Product/Variant | `SetNull` | Keep order snapshots if catalog rows go away |
| AuditLog FKs | `SetNull` | Keep audit rows after actor/store removal |
| Category parent | `Restrict` | Prevent accidental orphaning of trees |
| Product → Variants / ProductCategory | `Cascade` | Catalog children owned by product |

## Seed (development)

```bash
# required in root .env
SEED_SUPER_ADMIN_EMAIL=admin@ecomesta.local
SEED_SUPER_ADMIN_PASSWORD=<min-12-char-dev-password>

pnpm db:seed
```

Creates:

1. Super Admin user  
2. Demo tenant (`demo-merchant`)  
3. Demo store (`demo-store`)  
4. Tenant OWNER membership  
5. Store STORE_MANAGER membership  
6. Starter subscription plan + active subscription  

No fake products/orders are seeded in Phase 2.

## Migrations

| Migration | Purpose |
| --- | --- |
| `20250925120000_init` | Phase 1 health probe |
| `20260925210100_phase3_auth_sessions` | Phase 3 auth sessions |

Never edit applied migrations; create new ones for schema changes.
