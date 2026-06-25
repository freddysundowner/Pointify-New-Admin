---
name: createSubscription User-vs-Admin collection mismatch
description: Why POST /subscriptions can 500 or misprice — upstream looks up the customer in the wrong collection vs the rest of the app.
---

Upstream `POST /subscriptions/` (`createSubscription`) resolves the customer with `User.findById(userId)`, but the rest of the app (e.g. `getAllPackages?id=`, the admins list the admin-panel uses) resolves the same account with `Admin.findById(id)`. Shop-owner accounts live in the **Admin** collection.

Consequences when the admin-panel passes an Admin `_id` as `userId`:
- `User.findById(adminId)` returns null → `user?.pricingGroup` is undefined → `isOld = false` → the customer is ALWAYS treated as a new (formula-priced) user, never "old", regardless of their real pricing group. (Not a crash — optional chaining.)

## REAL root cause of the "send payment prompt" 500 (required `shop` field)

`createSubscription` does `new Subscription({ ..., shop, ... }).save()` where `shop` is the
SINGULAR field from the request body. The upstream `models/subscription.js` schema marks
**`shop` as `required: true`** (separate from the `shops` array, also required). The frontend
originally sent only `shops` (array), so `shop` was undefined → Mongoose validation throws
"Path `shop` is required" → caught → generic `500 {error:"Internal Server Error"}` (~344ms, fast).

**Fix:** send `shop: selectedShops[0]` alongside `shops` (added `shop` to `SubscriptionCreateInput`
in openapi.yaml — required + property — regenerated client/zod; frontend submit sends both).

**Key disproof — a 500 here is NOT M-Pesa:** `sendMpesaStkPush` (shared/functions.js) wraps its
whole body in try/catch and returns `{ status:false, message:"Error happened...", error }` inside
a 200 — it NEVER throws. So bad phone / gateway / token errors surface as `status:false` (UI
already treats that as "failed"), never a 500. Therefore any 500 from POST /subscriptions is a
pre-M-Pesa throw (schema validation on `.save()` or a null `Package.findById` destructure), not a
payment/credentials problem.

**Why:** discovered when the user's logged-in test of the statistics "send payment prompt" hit
`POST /api/subscriptions → 500`. Verified: proxy forwards body+auth correctly; `/packages/for-user`
returns real Mongo `_id`s (so package resolves); `calculateNewPriceByShops` is safe.

**How to apply:** money ops are never live-tested here (real STK write). When this endpoint 500s,
read the upstream MODEL for required fields and confirm the payload supplies every one — do NOT
assume M-Pesa config. If old-vs-new pricing looks wrong for a known "old" customer, suspect the
User-vs-Admin lookup above.
