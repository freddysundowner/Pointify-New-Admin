---
name: Bulk email via Brevo
description: How the Email Hub sends bulk email and where Brevo credentials live
---

- Upstream POS has NO email capability; bulk email is implemented entirely in our api-server (`/api/email/bulk`, `/api/email/status`).
- **Brevo credentials live in the upstream global settings** (`GET /settings/` → `EMAIL_CONFIG`: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`), editable from the admin Settings page. Env vars `BREVO_API_KEY`/`EMAIL_FROM`/`EMAIL_FROM_NAME` act only as an override. Do NOT ask the user for SMTP/Brevo secrets — they're already in Settings.
- Audience resolution: `all` pages upstream `/admin/`; segments page upstream `/admin/users/subscriptions?subscriptionType=&subscriptionStatus=` (returns `{admins,totalPages,...}`) — this matches the platform's own classification.
- **Send safety gate:** real sends only when `NODE_ENV=production` or `EMAIL_SEND_ENABLED=true`; otherwise the route returns 202 `status:"dry_run"` with the resolved total and sends nothing. **Why:** dev talks to the live POS API — without the gate a dev test would email real customers.
- No email logs (stateless proxy, no DB); outcomes are only in server logs.
- **Test sends** (`/api/email/test`, `/api/sms/test`) deliberately bypass the production gate (single, operator-typed recipient). SMS test reads provider creds from upstream settings `SMS_CONFIG` (blessedtexts-style; success = body status_code 1000).
- All send endpoints (bulk + test) have an in-memory fixed-window rate limit keyed by admin id + IP (`lib/sendRateLimit.ts`). **Why:** the JWT gate is decode-only (upstream can't verify tokens), so the limiter caps abuse of billable sends. Architect flagged the decode-only auth as a residual risk — unfixable without an upstream signing secret.
