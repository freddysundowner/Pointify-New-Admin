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
- Pipeline stage/source constants are duplicated in portal.ts, portal leads.tsx, and admin leads.tsx (plus the detail sheets LeadDetailSheet.tsx / LeadDetailDialog.tsx) — keep them all in sync.
- Leads carry an `activities` subdoc timeline (`created` / `stage_changed` / `follow_up_set` / `details_updated` / `note`), maintained by the upstream controller; notes are appended via `POST /leads/:id/activities` (owner-scoped). Older deployments have no `activities` field and 404 the note route — UIs must render an empty timeline defensively.
- `GET /leads/:id` also accepts a comma-separated `affiliate` scope (admin detail = all partner ids; master opening a sub's lead = sub ids, tried only after the own-scope read 404s). Old deployments 500 on comma lists here too.

**Why:** the upstream is otherwise unauthenticated and the leads data is cross-partner sensitive; the deliverable-zip deployment lag is a recurring source of confusing 500s.
**How to apply:** when touching leads endpoints/UI or debugging lead 500s, check whether staging runs the current zip first.
