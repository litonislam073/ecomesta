# Custom Domains (Phase 17)

Merchants attach custom hostnames to a store, prove ownership with a DNS TXT
challenge, activate the host for the public storefront, and optionally promote
it to the canonical primary. Every store also gets a free platform subdomain
`{slug}.{PLATFORM_ROOT_DOMAIN}` (default `ecomesta.local`).

## Architecture

| Layer | Responsibility |
| --- | --- |
| `Domain` (Prisma) | Per-store hostname: `type` (`SUBDOMAIN` / `CUSTOM_DOMAIN`), `status`, `isPrimary`, `verificationToken` |
| `DomainsService` | Merchant list/create/verify/activate/set-primary/disable/delete; audit events |
| `StoreDomainResolver` | Host → ACTIVE store mapping; Redis cache; platform subdomain provisioning |
| `PublicDomainController` | Unauthenticated `GET /public/domain/resolve?host=` for edge routing |
| `apps/merchant` `/dashboard/domains` | Domain management UI with DNS instructions |
| `apps/web` middleware | Resolves `Host` via the public API, sets `ecomesta.storeSlug` (+ canonical host) cookies |
| `apps/admin` store detail | Read-only domain list — **never** includes `verificationToken` |

Shared contracts in `@ecomesta/types`: `StoreDomain`, `StoreDomainList`,
`CreateStoreDomainRequest`, `DeletedStoreDomain`, `ResolvedStorefrontDomain`,
`DomainVerificationRecord`, `DomainStatus`, `DomainType`.

## Lifecycle

```
PENDING ──verify──► VERIFIED ──activate──► ACTIVE
   │                    │                    │
   └── failed check ──► FAILED               ├── set-primary
                         │                   └── disable ──► DISABLED
                         └── verify again
```

- **PENDING / FAILED / VERIFIED**: merchant DTOs expose `verification` with the
  TXT host and the token value (never a raw `verificationToken` field on the
  wire). ACTIVE / DISABLED / platform subdomains return `verification: null`.
- **ACTIVE**: storefront answers on the hostname. Exactly one domain per store
  is `isPrimary` (canonical host for SEO and redirects).
- Disabling or deleting the primary falls the primary back to the platform
  subdomain. The subdomain itself cannot be deleted or disabled.

## Merchant APIs

Bearer token, store-scoped. Reads require store access; writes require
`STORE_MANAGER` (or tenant OWNER/ADMIN / SUPER_ADMIN).

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/stores/:storeId/domains` | Provisions the platform subdomain on first list |
| POST | `/api/v1/stores/:storeId/domains` | `{ hostname }` — protocol/path/port stripped |
| GET | `/api/v1/stores/:storeId/domains/:domainId` | Single domain |
| POST | `.../domains/:domainId/verify` | Checks TXT at `_ecomesta-verification.<host>` |
| POST | `.../domains/:domainId/activate` | Serves storefront on a VERIFIED host |
| POST | `.../domains/:domainId/set-primary` | Canonical host (must be ACTIVE) |
| POST | `.../domains/:domainId/disable` | Stops serving without deleting |
| DELETE | `.../domains/:domainId` | Releases the hostname |

List response `meta` includes `platformRootDomain`, `canonicalHostname`, and
`total`.

## Public resolve

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/domain/resolve?host=` |

Returns `{ success, data: ResolvedStorefrontDomain }` for an ACTIVE hostname.
Unknown, inactive, and suspended hosts all 404 with the same message (no tenant
enumeration). The resolver also accepts the request `Host` / `X-Forwarded-Host`
when `host` is omitted.

## DNS verification

1. Merchant adds a custom hostname → status `PENDING`, token issued.
2. Add a TXT record:
   - **Host / name:** `_ecomesta-verification` (or the FQDN
     `_ecomesta-verification.<hostname>` depending on the registrar)
   - **Value:** the `verification.recordValue` token (`eco_…`)
3. **Verify** — matching TXT → `VERIFIED`; miss → `FAILED` (token stays visible).
4. Point the hostname at the platform (CNAME or apex A) and **Activate**.
5. Optionally **Set primary** so SEO canonical URLs use the custom host.

## Merchant UI

`/dashboard/domains` (`apps/merchant`):

- Lists type, status, primary badge, verified date
- Add form (writes gated by `useCanManageStore`)
- DNS TXT instructions for PENDING / FAILED / VERIFIED
- Verify / Activate / Set primary / Disable / Delete (Disable and Delete behind
  `ConfirmDialog`)
- Nav item **Domains** is `ready: true`

Components under `src/components/domains/`: `DomainList`, `AddDomainForm`,
`DnsInstructions`, `DomainStatusBadge`, `CopyValue`.

## Storefront routing (`apps/web`)

Middleware resolution order:

1. Resolve request host (`Host` only unless `TRUST_PROXY=true` / `TRUSTED_PROXY_HOPS>=1`, in which case `X-Forwarded-Host` is preferred). Nginx must overwrite `X-Forwarded-Host` from `$host`.
2. If hostname **resolves** to an ACTIVE storefront → **hostname wins**. Conflicting `?store=` is ignored / redirected away (never applied).
3. `?store=<slug>` is allowed only on loopback, `*.localhost` and hosts ending `.local` (platform preview). Unknown or unresolved production hosts never select a store from the query.
4. Pure loopback without `?store=` — skip resolve; keep existing cookie / env behavior
5. API 404 on unknown host → rewrite to `/store-not-found`; API down → fall through **without** `?store=` (the parameter is stripped from the rewritten request on production hosts so pages cannot fall back to it)

`store-resolver` prefers middleware headers/cookies from hostname resolution
over `?store=` and `NEXT_PUBLIC_DEFAULT_STORE_SLUG`. When a canonical host is known,
`generateMetadata` sets `metadataBase` and absolute canonical URLs.

Local tip: map `{slug}.ecomesta.local` in `/etc/hosts` (or use `?store=` on
loopback / `.local`) — `.local` allows `?store=` preview but still resolves
platform subdomains like production.

## DNS verification (hashed tokens)

1. Merchant adds a custom hostname → status `PENDING`, server stores **SHA-256** of the token (`sha256:…` in `verification_token`).
2. Create / `POST …/regenerate-verification` returns the **raw** TXT value **once**.
3. List/get never return the raw token or hash — only `verificationConfigured` + DNS host/name instructions.
4. Add TXT at `_ecomesta-verification.<host>` with the raw value, then **Verify** (server hashes presented TXT and compares).
5. Successful verify **clears** the stored hash; activate clears any remainder.

## Security

- Hostname ownership is not enumerable (identical conflict / 404 messages)
- Verification secrets leave the API only on create/regenerate responses
- Admin and public surfaces never see the token
- Writes audited: `DOMAIN_CREATED`, `DOMAIN_VERIFIED`, `DOMAIN_ACTIVATED`,
  `DOMAIN_PRIMARY_CHANGED`, `DOMAIN_DISABLED`, `DOMAIN_DELETED`,
  `DOMAIN_VERIFICATION_REGENERATED`
- Merchant UI gates are UX only; `AuthorizationService` remains authoritative

## Config

| Variable | Purpose |
| --- | --- |
| `PLATFORM_ROOT_DOMAIN` | Root for `{slug}.…` subdomains (default `ecomesta.local`) |
| `NEXT_PUBLIC_API_URL` | Storefront middleware resolve target (browser and fallback) |
| `API_INTERNAL_URL` | Server-side resolve/render target on the private network (set by `docker-compose.prod.yml`) |
| `NEXT_PUBLIC_DEFAULT_STORE_SLUG` | Local fallback when no host / `?store=` |
| `TRUST_PROXY` / `TRUSTED_PROXY_HOPS` | Honor `X-Forwarded-Host` only behind a trusted edge |

## Testing

| Suite | Coverage |
| --- | --- |
| `apps/api/test/phase17-domains.e2e.spec.ts` | Lifecycle, resolve, audit, hashed token |
| `apps/merchant/.../domains/domains.test.tsx` | List, add, DNS copy, verify/activate/primary, confirm delete/disable, read-only |
| `apps/web/src/lib/domain-routing.test.ts` | Host normalize, resolve, middleware cookies, hostname-wins `?store=` |
| `apps/web/src/lib/store-resolver.test.ts` | Cookie/header priority over `?store=`, canonical SEO helpers |
| `apps/admin/.../stores/stores.test.tsx` | Domains on detail; token never rendered |
