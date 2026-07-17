---
name: Admin-panel session tokens
description: How admin-panel operator auth works and why upstream tokens can't be verified
---
Operators log in via upstream Staff collection (POST /staff); staff never appear in the upstream Admin directory, so directory cross-checks 401 real operators. The proxy cannot verify upstream JWT signatures (no upstream secret).

**Rule:** proxy-gated admin endpoints (composed subscriptions current view, What's New save) must verify the proxy-minted HS256 session token (lib/adminAuth.ts, signed with SESSION_SECRET, minted at login in routes/auth.ts). Payload keeps upstream claim names `_id`/`email` (+ embedded upstream token `ut`) so payload-decoding consumers like the bulk-SMS sender gate keep working.

**Why:** any check against the upstream admin directory silently breaks staff logins; presence-only decode is forgeable.
**How to apply:** gate new sensitive/composed admin routes with verifyAdminSession; never reintroduce admin-directory cross-checks for operator tokens. Changing token claims requires operators to re-login. SESSION_SECRET must exist in every deployed env or login 502s.

Upstream also now exposes GET /subscriptions/current/list (one row per shop-pointed current subscription, `shops` populated) — the current-mode proxy fetches it whole and filters/paginates proxy-side.
