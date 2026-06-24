---
name: createSubscription User-vs-Admin collection mismatch
description: Why POST /subscriptions can 500 or misprice — upstream looks up the customer in the wrong collection vs the rest of the app.
---

Upstream `POST /subscriptions/` (`createSubscription`) resolves the customer with `User.findById(userId)`, but the rest of the app (e.g. `getAllPackages?id=`, the admins list the admin-panel uses) resolves the same account with `Admin.findById(id)`. Shop-owner accounts live in the **Admin** collection.

Consequences when the admin-panel passes an Admin `_id` as `userId`:
- `User.findById(adminId)` returns null → `user?.pricingGroup` is undefined → `isOld = false` → the customer is ALWAYS treated as a new (formula-priced) user, never "old", regardless of their real pricing group.
- The endpoint wraps everything in a try/catch returning generic `500 {error:"Internal Server Error"}`. Observed 500s on the "send payment prompt" flow most likely originate in the M-Pesa STK call (`callMpesaApi`→`subscribe`→`sendMpesaStkPush`) or the upstream environment (M-Pesa creds/callback), not in our proxy or payload — the proxy is a correct passthrough and the frontend sends valid Mongo `_id`s.

**Why:** discovered when the user's own logged-in test of the new statistics "send payment prompt" hit `POST /api/subscriptions → 500`. Tracing upstream showed the collection mismatch and that `calculateNewPriceByShops` is safe (never throws).

**How to apply:** money ops are never live-tested here, so this can't be reproduced locally — treat 500s from this endpoint as an upstream/M-Pesa-config issue to raise with the POS API owner, not a proxy bug. The frontend already surfaces non-2xx via the mutation `onError` (no false-positive success). If old-vs-new pricing ever looks wrong for a known "old" customer, suspect this User-vs-Admin lookup.
