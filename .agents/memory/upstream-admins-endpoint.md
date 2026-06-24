---
name: Upstream admins (platform users) endpoint
description: What the upstream POS /admin/ list endpoint supports and how the proxy compensates for date filtering + the password leak.
---

The upstream POS API (`https://api.pointifypos.com`, source in `attached_assets/`) backs the Platform Users page via upstream `GET /admin/`.

- **Search is native, server-side:** upstream `name` query param does a `$or` regex over username, email, and phone. Our spec/proxy exposes `search` and maps it to upstream `name`. Do NOT filter these in the frontend.
- **Pagination is native:** `page` + `limit`, sorted `_id` desc (latest first). Returns `{data, count, totalPages, currentPage}`.
- **NO date filtering upstream.** Each admin has a `createdAt` Date field, but upstream cannot filter on it. The proxy compensates: when `from`/`to` are present it fetches the whole matching set (one big `limit`) and filters/paginates/counts in-process. The per-day registration count is just the post-filter `count` with `from === to`.
- **Day boundaries are EAT (UTC+3), not UTC.** Operator is in Kenya; "registered on a specific day" must use `+03:00` boundaries or late-evening UTC registrations land on the wrong calendar day. **Why:** a Nairobi operator's calendar day ≠ UTC day.
- **Upstream leaks `password` hashes** in `/admin/` list responses (aggregation doesn't project it out). The proxy must strip `password` before returning. Watch for the same leak on other admin endpoints (by-id, etc.).
- **No get-admin-by-id upstream** (already in replit.md): `/api/admins/{id}` fetches the list and finds the match.
