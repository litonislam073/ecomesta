# Website support chat

The Ecomesta marketing website (never merchant storefronts) has a support chat
answered by an AI assistant. Super Admins can read every conversation in the
admin console under **Platform → Support chats**.

## How a chat works

1. The visitor opens the chat and gives their **name and phone number**
   (required) and **email** (optional). `POST /api/v1/ai-support/conversations`
   creates the conversation and returns a `conversationId` plus a secret
   `conversationToken` (24 random bytes). Only the SHA-256 hash of the token is
   stored; the browser keeps the token in `sessionStorage` for that tab.
2. Each message goes to `POST /api/v1/ai-support/chat` with the id and token.
   The API checks them **before** calling OpenAI; a wrong, missing or expired
   pair gets `404 CHAT_NOT_FOUND` and the widget asks the visitor to start again.
3. The visitor's question and the reply they were shown are saved together.
   Nothing is saved when the assistant could not answer.
4. "Talk to a person" (`POST /api/v1/ai-support/handoff`) emails the support
   inbox (phone required, email optional) and, with a valid token, records the
   reference on the conversation.

The visitor's name, phone and email are never sent to OpenAI: the model only
sees the conversation text.

## Limits

| What | Limit |
| --- | --- |
| New chats per IP address | 10 per hour |
| Messages per IP address | 15 per minute, 150 per day |
| All chat requests (cost guard) | `AI_SUPPORT_DAILY_REQUEST_LIMIT`, default 5000 per day |
| Support requests | 3 per IP per hour, 3 per phone or email per day |

## Admin access

`GET /api/v1/admin/support-chats` (list and search by name, phone, email or
support reference) and `GET /api/v1/admin/support-chats/:id` (all messages)
require a Super Admin access token; any other account gets 403. Search terms are
masked (`search=[Redacted]`) in the API request log.

## Retention

Chats are kept for **365 days after their last message** (or after they were
started, if no message was sent). Set `AI_SUPPORT_RETENTION_DAYS` (whole days,
1–3650) to change it; an empty value means 365, anything else stops the API at
startup with a validation error. In production the variable must be in
`.env.production` (it is passed through by `docker-compose.prod.yml`); restart
the `api` service after changing it.

- **Hidden immediately.** An expired chat disappears from the admin list,
  search and detail pages and can no longer receive messages, even before it is
  deleted.
- **Deleted every 6 hours** by a timer inside the API process (the first run is
  one minute after start-up), like the subscription scheduler — there is no
  separate worker or queue. Each run deletes expired chats in batches of 500;
  their messages are removed by the `ON DELETE CASCADE` foreign key. Nothing
  else is touched: support-request emails, users, orders and merchant data stay.
- **Safe to repeat.** Runs are idempotent, and several API replicas running at
  the same time cannot delete anything that is not expired.
- **Logs** contain counts only (`retentionDays`, `conversations`, `messages`);
  failures log the error name and database error code, never chat text or
  contact details.

### Running it by hand

Without `--delete` it only reports what would be deleted.

```bash
# Production (inside the running API container)
$DC exec api node dist/cli/ai-support-retention.js            # dry run
$DC exec api node dist/cli/ai-support-retention.js --delete   # delete

# Local development
pnpm --filter @ecomesta/api ai-support:retention [--delete]
```

It prints one JSON line, for example
`{"mode":"dry-run","retentionDays":365,"cutoff":"…","conversations":0,"messages":0}`.

## Database

Migration `20261001120000_ai_support_conversations` adds the
`ai_support_conversations` and `ai_support_messages` tables and the
`AiSupportMessageRole` enum. It only creates objects, so it is safe on an
existing production database; apply it with `prisma migrate deploy` as usual.
