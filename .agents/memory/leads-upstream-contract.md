---
name: Leads upstream contract
description: How the proxy talks to the user's self-hosted /leads backend (deliverable zip) and its scoping rules.
---

# Leads upstream contract

- The lead endpoints live on the USER's POS API server, delivered as `pointify-leads-backend.zip` (models/controllers/routes). The staging upstream may lag the zip — after changing the deliverable, multi-feature requests can 500 upstream ("Cast to ObjectId failed" on comma lists) until the user redeploys it.
- `GET /leads` REQUIRES an `affiliate` query param (never unscoped). It accepts a single id or a comma-separated list (`$in`); the list response populates `affiliate` with `{_id,name,email,phonenumber}` — but older deployments return the bare id string, so UIs must render both shapes.
- "All partners" (admin) and "my team" (master partner) views are expressed as comma-joined affiliate id lists built by the proxy; the proxy resolves scope (portal: `resolveLeadScope`, 403 non-masters / 404 unknown sub) and writes stay scoped to the session's own affiliate id.
- Admin `GET /api/leads` is gated like bulk SMS: bearer must structurally decode to a JWT with a 24-hex `_id` (strongest possible without the upstream JWT secret). Plain `Bearer fake` must 401.
- Optional `LEADS_PROXY_SECRET` shared secret (sent as `x-proxy-secret`) locks the upstream `/leads` routes to this proxy; a no-op when unset.
- Pipeline stage/source constants are duplicated in portal.ts, portal leads.tsx, and admin leads.tsx — keep all three in sync.

**Why:** the upstream is otherwise unauthenticated and the leads data is cross-partner sensitive; the deliverable-zip deployment lag is a recurring source of confusing 500s.
**How to apply:** when touching leads endpoints/UI or debugging lead 500s, check whether staging runs the current zip first.
