---
name: Statistics shop/user active classification
description: The authoritative way to count active/expired shops and paying/trial users on the Pointify platform.
---

# Shop & user "active" classification — single source of truth

The authoritative upstream method is `subscriptionStatistics()` in
`controllers/subscription.js` (route `GET /subscriptions/shop/stats`). Any new
aggregate that buckets shops or users by active/expired MUST mirror it, or the
numbers will silently disagree with the dashboard.

**Rule:**
- Start from `Shop` where `subscription != null`, `$lookup` the current
  `Shop.subscription` doc, then `$lookup` its `package`. Classify by
  `package.type` (`trial` | `production`), NOT by `subscription.type` and NOT by
  unwinding `subscription.shops`.
- A shop is **active** only when `subscription.paid === true` AND
  `startDate <= now` AND `endDate >= now`. Otherwise it is expired.
- **Users (admins):** an admin is "paying" if ANY of their shops is
  active-production; else "trial" if ANY is active-trial. Production takes
  precedence over trial.

**Why:** Subscriptions can be stored on a singular required `shop` field (legacy
/ trial subs created via `shop.js` set only `shop`, never `shops`). Unwinding
`subscription.shops` drops those records and undercounts. The other shop-stats
endpoint `/shop/stats/metrics` (`getShopStats`) uses `status:true` + unwinds
`shops` — it diverges and is NOT authoritative. Always anchor to
`subscriptionStatistics`, which keys off the `Shop.subscription` pointer.

**How to apply:** Used by `deliverables/statistics.controller.js` (the upstream
method the operator pastes into their POS API for `GET /statistics`). If a future
stats feature needs active/expired shop or user counts, replicate this exact
predicate rather than inventing a new one.
