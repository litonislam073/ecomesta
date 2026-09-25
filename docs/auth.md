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

JSON `refreshToken` is also returned for non-browser clients and automated tests. Do **not** persist it in `localStorage`.

Cross-app CORS uses `WEB_URL`, `MERCHANT_URL`, `ADMIN_URL`, and `CORS_ORIGINS` with `credentials: true`. No `origin: *`.

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
