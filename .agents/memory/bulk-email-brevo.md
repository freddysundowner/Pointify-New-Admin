---
name: Bulk email via Brevo
description: How the Email Hub sends bulk email and where Brevo credentials live
---

- Upstream POS has NO email capability; bulk email is implemented entirely in our api-server (`/api/email/bulk`, `/api/email/status`).
- **Brevo credentials live in the upstream global settings** (`GET /settings/` → `EMAIL_CONFIG`: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`), editable from the admin Settings page. Env vars `BREVO_API_KEY`/`EMAIL_FROM`/`EMAIL_FROM_NAME` act only as an override. Do NOT ask the user for SMTP/Brevo secrets — they're already in Settings.
- Audience resolution: `all` pages upstream `/admin/`; segments page upstream `/admin/users/subscriptions?subscriptionType=&subscriptionStatus=` (returns `{admins,totalPages,...}`) — this matches the platform's own classification.
- **Send safety gate:** real sends only when `NODE_ENV=production` or `EMAIL_SEND_ENABLED=true`; otherwise the route returns 202 `status:"dry_run"` with the resolved total and sends nothing. **Why:** dev talks to the live POS API — without the gate a dev test would email real customers.
- No email logs (stateless proxy, no DB); outcomes are only in server logs.
