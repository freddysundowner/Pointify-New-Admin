---
name: Upstream POS analytics endpoints
description: Which upstream endpoint gives correct shop/trial/subscription stats, and which one lies.
---

# Shop / subscription breakdown stats

Use upstream `GET /subscriptions/shop/stats` (controller `subscriptionStatistics`) as the
authoritative source for shop status counts. Response shape:
`{ users: { active|expired: {total,trial,production} }, shops: { active|expired: {total,trial,production} } }`.

**Why:** It classifies each shop by its **package.type** (trial | production) via a `$lookup`,
and treats a shop as active only when `subscription.paid === true` AND `startDate <= now <= endDate`.

**Do NOT use `GET /shop/stats/metrics` for trial/active/expired counts** — it is unreliable and
massively undercounts trials (e.g. reported trialActive:0 / trialExpired:1 when reality was
~3 active / ~606 expired trials). It only classifies a fraction of shops.

**How to apply:** `/api/analytics/overview` composes from `/subscriptions/shop/stats` (shop
breakdown), `/subscriptions/summary/stats` (revenue), and `/admin/` count (totalUsers).
Map: productionActive=shops.active.production, trialActive=shops.active.trial, etc.;
payingUsers = users.active.production (owners with an active production sub).

**General lesson:** the user has the upstream source in `attached_assets/pointifyposapi_extracted/`.
When in doubt about which endpoint returns real data, read the controllers/routes there
(`routes/*.js`, `controllers/*.js`) instead of guessing or computing from raw lists.
