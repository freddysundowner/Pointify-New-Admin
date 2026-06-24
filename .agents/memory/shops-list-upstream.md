---
name: Shops list upstream constraints
description: What the upstream POS /shop/ list endpoint can and cannot filter/return, for the admin Shops page.
---

# Upstream `/shop/` (getAllShops) list contract

Authoritative source: `attached_assets/pointifyposapi_extracted/.../controllers/shop.js` `getAllShops`.

## Supported query params (forward via proxy as-is)
- `page`, `limit`
- `name` — regex (case-insensitive) on **shop name only**
- `subscriptionStatus` — `active` (subscription.endDate >= now) | `expired` (endDate < now)
- `subscriptionType` — matches `subscription.packageId.type`, enum `trial` | `production`
- `ownerid` — single admin `_id` (NOT a list, NOT a text search)

## NOT supported upstream (do not fake client-side)
- Free-text **owner search** (only single `ownerid`; no owner email/name search param).
- **Expiry-date-range** search (only active/expired status).

## Response shape & owner projection
- Returns `{ shops, totalShops, totalPages, currentPage }`. Proxy `normalizeList` maps `shops`→data and **`totalShops`→count** (count candidate had to be added, else count = page size).
- Each shop: `subscription` populated (endDate, type, packageId.type) and `adminId` **projected to ONLY `{_id, email, phone}` — NO username**. So owner "name" is unavailable from this endpoint; display owner email + phone.

**Why:** non-obvious projection/param limits; verified against upstream source, not guessed. Relation fields (adminId/subscription) can also arrive as bare id strings — read defensively.
