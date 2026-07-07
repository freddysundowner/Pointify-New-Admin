---
name: Partner leads CRM proxy model
description: How the partner-side lead-tracking CRM is wired and why the upstream trust boundary works the way it does
---

The partner-portal lead-tracking CRM stores leads in the user's OWN upstream
MongoDB (a `/leads` collection on api.pointifypos.com), NOT in Replit Postgres.
The user explicitly wanted data to live on their own server. The deliverable
Node.js/Mongoose files for them to paste into that server live in
`pointify-leads-backend/` (model + controller + route + README).

Every lead is scoped by `affiliate` (ObjectId ref `Affliate`). The proxy derives
the affiliate id from the verified partner session (`session.aid`) and injects it
server-side (query on reads/delete, body on create) — never trusted from the
client. This is the SAME trust model every other portal endpoint uses
(`/portal/shops`, `/portal/users` forward `affliate=session.aid` as an upstream
query param), because the whole upstream POS API runs with auth effectively
disabled (verifyToken is a no-op — see bulk-sms-and-proxy-auth.md).

**Cross-tenant (IDOR) hardening — optional shared secret.** Because the upstream
trusts a client-supplied `affiliate`, a direct caller could forge another
partner's id. To close this WITHOUT the 24h-JWT-expiry UX problem that strict
token-verify would cause, there is an opt-in shared secret `LEADS_PROXY_SECRET`:
- Proxy: `leadsProxyHeaders()` in portal.ts sends `x-proxy-secret` on every
  `/leads` upstream call when the env var is set (no-op when unset).
- Upstream: `routes/leads.js` has route-level middleware that rejects (403) any
  request lacking the matching header when the env var is set on their server.
- Requires the SAME secret set on BOTH the Replit project and their POS server.
**Why:** architect flagged the upstream openness; strict JWT-verify would log
partners out of leads when the forwarded upstream token expires (~24h) while
other pages still work. A shared secret has no expiry and is a one-env-var lock.

`upstreamFetch` gained an optional `headers?: Record<string,string>` field
(merged after defaults) specifically to carry this secret.
