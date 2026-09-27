# Authentication & RBAC (Phase 3)

## Architecture

- NestJS `AuthModule` under `apps/api/src/modules/auth`
- Passwords hashed with **Argon2id** (`@node-rs/argon2`)
- Access JWT (short-lived) via `Authorization: Bearer`
- Refresh JWT stored as **HttpOnly cookie** (`ecomesta_refresh_token`) and optionally returned in JSON for API clients / tests
- Refresh sessions persisted in `auth_sessions` with **SHA-256 token hashes only**
- Refresh-token **rotation** on every `/auth/refresh`
- RBAC foundation via `@Roles()` + `RolesGuard` using Phase 2 enums
- Membership lists loaded from DB (not embedded in JWT)

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Public |
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/refresh` | Refresh cookie or body |
| POST | `/api/v1/auth/logout` | Access token |
| GET | `/api/v1/auth/me` | Access token |

OpenAPI: `/api/docs`

## Cookie vs body refresh tokens

Preferred browser flow:

1. Login/register sets HttpOnly cookie scoped to `/api/v1/auth`
2. Browser calls refresh with `credentials: 'include'`
3. Access token stays in memory on the client (not localStorage)

**SameSite policy:** when `API_URL` and `WEB_URL` / `MERCHANT_URL` / `ADMIN_URL` share a site (same eTLD+1, including all `localhost` ports), cookies use `SameSite=Lax`. True cross-site deployments use `SameSite=None; Secure` and **omit `refreshToken` from the JSON body** whenever the cookie is set, so XSS cannot exfiltrate a body token. Non-production same-site setups still return `refreshToken` in JSON for API tests and non-browser clients. Body `refreshToken` on `/auth/refresh` remains optional for clients that send it explicitly without a cookie.

Cross-app CORS uses `WEB_URL`, `MERCHANT_URL`, `ADMIN_URL`, and `CORS_ORIGINS` with `credentials: true`. No `origin: *`.

## Suspension semantics

| Subject | Effect |
| --- | --- |
| **User** `SUSPENDED` | All `AuthSession` rows revoked immediately. Login/refresh blocked. Existing access JWTs fail on next validated request (`validateAccessPayload` loads DB user status). |
| **Tenant** `SUSPENDED` | Public storefront / payments return 404 for that tenant's stores (even if store row is `ACTIVE`). Authenticated store/tenant-scoped ops return **403** via `AuthorizationService`. `/auth/me` may still succeed while the JWT/session is valid. |
| **Store** `SUSPENDED` | Same public 404 pattern; merchant store-scoped ops 403. |
| **Platform role downgrade** | `validateAccessPayload` always loads `platformRole` from the DB — stale JWT claims cannot elevate. Super Admin mutations still go through `assertSuperAdmin`. |

## Rate limiting

1. Global Nest `ThrottlerGuard` (120 req / 60s baseline)
2. Auth-specific Redis counters (`auth:rl:*`) for register/login/refresh, with in-memory fallback if Redis is temporarily unavailable

## Security middleware

`helmet` is enabled with CSP disabled for API/Swagger friendliness. Sensitive fields (`password`, tokens, cookies) are redacted from Pino logs.

## Guards & decorators

- `AccessTokenGuard` / `RefreshTokenGuard`
- `RolesGuard` + `@Roles(...)`
- `@CurrentUser()`
- `@Permissions(...)` placeholder for later fine-grained ACL
