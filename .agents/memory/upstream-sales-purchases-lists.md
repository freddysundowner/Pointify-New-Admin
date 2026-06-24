---
name: Upstream sales & purchases list pagination
description: How the Pointify upstream paginates sales and purchases, and the response-shape quirks the proxy must absorb.
---

- Sales list = upstream `GET /sale/filter` (`getSales`). Paginates only when `page` is present (uses `limit || 10`). Paginated response is already the normalized shape `{ data, count, totalPages, currentPage }`; without `page` it returns `{ sales: [...] }`.
- Purchases list = upstream `GET /purchase/` (`getAllPurchases`). Paginates only when **both** `page` AND `limit` are present. Paginated response is `{ purchases, page, limit, total }` — it has **no** `totalPages`. Without page+limit it returns a bare array.
- Both populate `attendantId` with `username` only and `shopId` with `name` only; both sort `createdAt` desc.

**Why:** the two endpoints use different pagination triggers and different response shapes, so a single client call style needs the proxy to absorb the difference.
**How to apply:** the frontend must always send both `page` and `limit` (purchases ignores page alone). `normalizeList` derives `totalPages = ceil(count/limit)` when `totalPages` is absent but `limit` is present, so the purchases shape paginates correctly. Render attendant/shop defensively (populated object OR bare id string). The real timestamp field is `createdAt` — the spec's `createAt` is a legacy typo; read `createdAt ?? createAt`.
