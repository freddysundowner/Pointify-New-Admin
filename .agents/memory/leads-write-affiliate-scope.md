---
name: Leads write affiliate scope
description: Upstream leads API accepts comma-separated affiliate lists for reads but requires a single ID for writes (POST activities, PUT, DELETE).
---

# Leads write affiliate scope

## The rule
- **Reads** (`GET /leads`, `GET /leads/:id`): pass `affiliate` as a comma-separated list of all partner IDs — upstream uses it as a `$in` filter.
- **Writes** (`POST /leads/:id/activities`, `PUT /leads/:id`, `DELETE /leads/:id`): must pass a **single** affiliate ID — upstream uses it for ownership verification and rejects lists with HTTP 400.

**Why:** Confirmed by a live 400 upstream error when the admin note endpoint sent a comma-joined list. The portal's equivalent routes use `session.aid` (a single ID) and work fine.

## How to apply
For any admin write to a lead:
1. Fetch all affiliate IDs from `/affiliates/`.
2. GET the lead using the broad comma-joined scope to identify the lead's owner (`lead.affiliate._id` or `lead.affiliate` if it's a bare string).
3. Use that single owner ID as `affiliate` in the write request.

See `resolveLeadAffiliate()` in `artifacts/api-server/src/routes/partners.ts` for the reusable helper.
