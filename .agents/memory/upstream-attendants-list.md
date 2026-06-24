---
name: Upstream attendants list endpoint
description: How the proxy lists attendants with server-side pagination, username search, and admin/shop scoping.
---

- The global attendants list uses upstream `GET /attendants/all/:id` (NOT `/attendants/shop/filter`, which returns all 1519 with no pagination). It returns `{ attendants: [...populate("shopId")...], pagination: { total, page, limit } }`.
- The `:id` path segment is an **admin filter sentinel**: `id === "admin"` means "no admin filter / show all"; any other value is treated as `adminId`. The route requires a segment, so the proxy sends `admin` when no adminId is given. Calling `/attendants/all` (no segment) 500s — it gets swallowed by `/attendants/:id` (getAttendantById).
- Supported query params: `page`, `limit`, `username` (case-insensitive regex). The proxy passes `page`/`limit`/`username`/`shopId` as query and `adminId` as the path segment.
- **shopId is NOT honored by the controller** as of 2026-06-24 — passing it returns the full list. Shop filtering needs the user to add `if (shopId) filter.shopId = shopId;` to upstream `getAllAttendants`. Until then the admin-panel shop filter silently shows everyone.
- Most attendants genuinely have no `shopId` (≈1250 of 1519), so a blank/N/A shop column is real data, not a bug. When `shopId` exists it comes back as a populated shop object with `name`.

**Why:** the controller's `if (id !== "admin")` guard plus the required `:id` route means the only way to get an unscoped list is the literal sentinel `admin`. This endpoint nests paging under a `pagination` object, so any list normalization must read `total/page/limit` from `o.pagination` (not just top-level), or pagination silently collapses to one page.
**How to apply:** when wiring attendants list features, send `admin` for the all case; reset to page 1 when username/shop changes; don't expect shop filtering to work server-side until the upstream controller adds the shopId clause.
