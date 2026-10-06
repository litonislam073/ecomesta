# Transactional email

Merchant account emails are sent by the NestJS API only. SMTP credentials live
in the API container's environment and are never exposed to the Next.js apps,
browser bundles, API responses, health checks or logs.

## Architecture

```
AuthService / OnboardingService / StoresService / SupportService / AccountRecoveryService
        │
        ▼
EmailService (apps/api/src/modules/email) ── the only email entry point
        │
        ├─ outbox emails ──► email_deliveries row (PENDING, idempotency key)
        │                     written inside the caller's DB transaction
        │                     └─► EmailDispatcher (in-process timer + kick after commit)
        │
        └─ token emails ───► sent immediately in the background (reset / verification)
                              raw token only in memory, delivery logged without payload
        │
        ▼
EmailComposer ─► templates (table layout, inline styles, HTML + plain text)
        │
        ▼
EmailProvider interface ─► SmtpEmailProvider (Nodemailer) | ConsoleEmailProvider | DisabledEmailProvider
```

- **Event names** are centralized in `email.events.ts` (`EMAIL_EVENTS`). Billing
  events (`TRIAL_STARTED`, `PAYMENT_FAILED`, `INVOICE_CREATED`, …) are reserved
  names only; nothing sends them yet.
- **No new container.** Delivery runs inside the existing `api` process, like the
  subscription lifecycle scheduler. Rows are claimed atomically
  (`UPDATE … WHERE status = PENDING/FAILED`), so several API replicas never send
  the same row twice. Stale `SENDING` claims are reclaimed after 10 minutes.
- **Retries:** up to 5 attempts with backoff 0 → 1 min → 5 min → 15 min → 60 min.
  Permanent errors (recipient rejected, bad configuration) stop immediately.
  The stored payload is cleared as soon as a row is `SENT`, `SKIPPED` or finally
  `FAILED`.
- **Idempotency keys:** `MERCHANT_WELCOME:<userId>`, `STORE_CREATED:<storeId>`,
  `PASSWORD_CHANGED:<resetTokenId>`, `SUPPORT_REQUEST:<userId>:<requestId>`.
  A retried request or a second process can never enqueue a duplicate.
- **Commit safety:** welcome and store-created rows are written in the same
  transaction as the user/store; if the transaction rolls back, no email exists.
  Delivery starts only after commit.
- **Reset and verification links are not retried from the queue** because the raw
  token must never be stored. They are attempted up to 3 times in the background
  (2 s and 8 s delays); if all fail the merchant simply requests a new link. The
  delivery log records the outcome without the link.

## Emails

| Event | Trigger | Content |
| --- | --- | --- |
| `MERCHANT_WELCOME` | Registration | Welcome, dashboard link, email confirmation link if unverified |
| `STORE_CREATED` | Onboarding or additional store, after commit | Store name, store URL, dashboard, plan when known; a sign-up store says it goes live once its payment is confirmed |
| `EMAIL_VERIFICATION` | Dashboard "Send confirmation email" | Link valid 48 h, single use |
| `PASSWORD_RESET` | `/forgot-password` | Link valid 60 min, single use |
| `PASSWORD_CHANGED` | Successful reset | Time (UTC), all sessions signed out, reset link if it wasn't them |
| `SUPPORT_REQUEST` | Dashboard → Help & support | Sent to `SUPPORT_EMAIL`, Reply-To = merchant |

No email is sent for logins or token refreshes. Emails never contain passwords,
access/refresh tokens or other secrets. Links carry tokens in the URL fragment
(`/reset-password#token=…`), so they never reach server or proxy access logs, and
the merchant app removes the fragment from the address bar immediately.

## Tokens

`auth_tokens` stores only a SHA-256 hash of each 256-bit random token, its
purpose, expiry, `usedAt` and requesting IP. Issuing a new token deletes the
user's other unused tokens of the same purpose. Consumption is a single atomic
update (`usedAt IS NULL AND expiresAt > now`), so a token works exactly once.

A completed reset, in one transaction: marks the token used, stores the new
Argon2id hash, confirms the email address (the merchant proved inbox access),
revokes **all** refresh sessions, deletes other unused reset tokens and queues
the password-changed email. An audit log entry `PASSWORD_RESET_COMPLETED` is
written. A failing email never rolls back the reset.

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/forgot-password` | Public | Always the same generic 200 response |
| POST | `/api/v1/auth/reset-password/validate` | Public | `RESET_TOKEN_INVALID` / `_EXPIRED` / `_USED` |
| POST | `/api/v1/auth/reset-password` | Public | Same codes; password policy as registration |
| POST | `/api/v1/auth/email-verification/send` | Access token | `{ alreadyVerified }` |
| POST | `/api/v1/auth/email-verification/confirm` | Public | `VERIFICATION_TOKEN_*` codes |
| GET | `/api/v1/support/contact` | Public | `{ supportEmail, requestsEnabled }` |
| POST | `/api/v1/support/requests` | Access token | 503 when `SUPPORT_EMAIL` is unset |
| GET | `/api/v1/admin/email` | Super Admin | Config (no credentials), 7-day counts, last 25 deliveries |

## Rate limits (Redis, per key, 429 `TOO_MANY_REQUESTS`)

| Action | Limit |
| --- | --- |
| Forgot password | 5 / hour per IP **and** 5 / hour per email (hashed key) |
| Reset password (validate + submit) | 20 / 15 min per IP |
| Send verification email | 5 / hour per user **and** per IP |
| Confirm verification | 20 / 15 min per IP |
| Support request | 5 / hour per user, 20 / hour per IP |

The forgot-password response is identical whether or not the account exists.
The per-email limit is keyed by a hash of the submitted address and applies to
unknown addresses too, so a 429 reveals nothing about account existence.

## Configuration

| Variable | Purpose |
| --- | --- |
| `EMAIL_PROVIDER_MODE` | `smtp`, `console` or `disabled`. Default: `console` in development, `disabled` in production |
| `SMTP_HOST` / `SMTP_PORT` | Provider SMTP server (587 STARTTLS or 465 TLS) |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP login. Read only by `EmailConfigService` |
| `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` | Sender, e.g. `no-reply@<root>` / `Ecomesta` |
| `SMTP_SECURE` | `true` = implicit TLS (465); `false` = STARTTLS required |
| `APP_PUBLIC_URL` | Marketing origin for the logo and footer links (defaults to `WEB_URL`) |
| `SUPPORT_EMAIL` | Receives support requests; shown in email footers |
| `EMAIL_PREVIEW_DIR` | Development only: also write rendered HTML files here |
| `EMAIL_DISPATCH_INTERVAL_MS` | Queue polling interval (default 30000) |

Links to the merchant app use the existing `MERCHANT_URL`; store links use
`{slug}.{PLATFORM_ROOT_DOMAIN}` exactly like the merchant dashboard.

**Production validation** (`NODE_ENV=production`, API exits with the variable
name, never its value):

- `console` mode and `EMAIL_PREVIEW_DIR` are rejected.
- With `smtp`: every `SMTP_*` value, `SUPPORT_EMAIL` and `APP_PUBLIC_URL` are
  required; `SMTP_PASSWORD` must not be a placeholder; `SMTP_HOST` must not be
  local; `APP_PUBLIC_URL` must be a public `https://` URL.
- With the mode unset or `disabled`, the API starts, records emails as `SKIPPED`
  and logs `Email delivery is disabled…` so the gap is visible.

At startup the API logs `Email provider configured: SMTP`, then checks the SMTP
connection and logs `SMTP connection verified` or `SMTP verification failed: <category>`
(category only, never credentials).

## Development

`EMAIL_PROVIDER_MODE=console` (the default) sends nothing. Each email is logged
as `[console email, not sent] EVENT: "subject"` — never the recipient body or
link. To view the rendered emails, set `EMAIL_PREVIEW_DIR=/tmp/ecomesta-emails`
and open the `.html` files. Development never delivers real email unless you
explicitly set `smtp` with real credentials.

Tests replace the provider with a capturing fake; `NODE_ENV=test` disables the
dispatcher timer.

## Verifying production

1. Set the variables in `.env.production` (see `.env.production.example`) and
   configure SPF, DKIM and DMARC for the sender domain at the email provider.
2. Apply the migration (`$DC run --rm migrate`) and recreate the `api` container.
3. `$DC logs api | grep -iE "email provider|smtp"` shows
   `Email provider configured: SMTP` and `SMTP connection verified`.
4. Super Admin → **Email** shows "Delivering email", the sender, support address
   and `SMTP login: Configured`.
5. Use **Forgot password?** on the merchant login with an account you own; the
   email arrives, the link opens `/reset-password`, and a second use of the link
   shows "already used". A password-changed email follows.
6. Super Admin → Email lists `PASSWORD_RESET` and `PASSWORD_CHANGED` as `SENT`.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| API exits: `EMAIL_PROVIDER_MODE=smtp requires SMTP_…` | Set the named variables |
| Log: `SMTP verification failed: authentication` | Credentials wrong; see the `authentication` row below |
| Log: `Email delivery is disabled` | `EMAIL_PROVIDER_MODE` unset or `disabled`; set `smtp` |
| Admin shows `FAILED` · `authentication` | Wrong `SMTP_USER` / `SMTP_PASSWORD`, or the provider requires an app password |
| `connection` / `timeout` | Wrong host/port, VPS firewall blocks outbound 587/465, or `SMTP_SECURE` doesn't match the port |
| `rejected` | Sender domain not verified at the provider, or recipient refused |
| Emails land in spam | Missing SPF/DKIM/DMARC for `SMTP_FROM_EMAIL`'s domain |
| Merchant sees "reset link expired" | Links last 60 min; request a new one |
| Support page says requests unavailable | `SUPPORT_EMAIL` not set on the API |
