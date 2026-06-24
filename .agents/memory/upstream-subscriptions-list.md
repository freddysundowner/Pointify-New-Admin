---
name: Upstream subscriptions list
description: Filter and pagination semantics of upstream getAllSubscriptions, and how the admin UI maps them.
---

# Subscriptions list (getAllSubscriptions)

Upstream `GET /subscriptions/` honors these query filters:
- `status`: `Active` (status:true + endDate>today), `Expired` (endDate<=today), `Cancelled` (status:false).
- `type`: `trial` | `production` — resolved by looking up Package ids of that type, then `packageId $in`.
- `shop`: shop id — matches either `shop` or `shops[]`.
- `shopname`: case-insensitive regex on Shop.name → matched shop ids.
- `invoiceNo`: exact match.
- `createAt`: single created-DAY filter (YYYY-MM-DD → start/end of that UTC day).
- `expiryperiodFrom` + `expiryperiodTo`: expiry (endDate) RANGE — applied ONLY when BOTH are
  present and neither is the string "null"; it also forces `status:true`.
- `page`, `limit`.

**Pagination quirk:** pagination only activates when `page` is present. With `page`, upstream
returns `{ data, count, totalPages, currentPage }`. WITHOUT `page` it returns a BARE ARRAY of
subscriptions (no wrapper). The proxy's `proxyList`/`normalizeList` coerces either shape, but the
frontend must always send `page` to get real pagination.

**How to apply (admin UI):**
- Always pass `page` + `limit`; render Previous/Next from `totalPages`/`currentPage`.
- Send the expiry range only when both dates are set (show a hint otherwise).
- Shop-scoped views set `shop=<id>`; the free-text `shopname` filter is for the global view.
