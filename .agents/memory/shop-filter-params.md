---
name: Upstream shop-filter query params
description: The (inconsistent) query param each upstream list endpoint uses to filter by a single shop.
---

# Filtering a list by one shop — param name differs per domain

Verified empirically against the real upstream (https://api.pointifypos.com) by curling with a known shopId and checking the returned items all belong to that shop. The wrong name silently returns the UNFILTERED full list (no error), so always verify.

| Domain | Proxy path → upstream | Shop param |
|---|---|---|
| Products | `/products` → `/product/` | `shopid` (lowercase — `shopId` does NOT filter) |
| Sales | `/sales` → `/sales/filter` | `shopId` |
| Purchases | `/purchases` → `/purchases/` | `shopId` |
| Subscriptions | `/subscriptions` → `/subscriptions/` | `shop` (an id; `shopname` is a separate name regex) |
| Attendants | `/attendants` → `/attendants/shop/filter` | `shopId` |

**Why:** the upstream POS controllers each destructure a different key; there is no consistent convention. A mismatched param is ignored, returning everything, which looks like a "filter not working" bug.

**How to apply:** these names are encoded in `lib/api-spec/openapi.yaml` list-op params (then codegen). The admin-panel uses `?shop=<id>&shopName=<name>` in the URL (see `src/lib/shop-filter.tsx`) and each page maps that single `shop` id onto the correct upstream param above. If filtering ever returns the full list, re-verify the param name against upstream first.
