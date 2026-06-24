---
name: Subscription status display semantics
description: Type-aware subscription "active" rules — trials key off expiry only; production needs `paid`.
---

# Subscription status is TYPE-AWARE (trial vs production)

Do not badge a subscription off the bare `status` boolean. Compute it type-aware:

- **Trial**: never expected to be `paid`. Validity is purely the expiry window —
  Active while `endDate` is in the future, otherwise Expired. Do NOT require `paid`.
- **Production**: real activity needs payment. Upstream shop-stats ground truth is
  `isActive = paid === true && startDate <= now && endDate >= now`
  (controllers/subscription.js). A production sub with `status:true` but `paid:false`
  was never actually paid → show Unpaid, NOT Active.

Date guards (both types): a missing/invalid `endDate` or a future `startDate` can
never be Active (→ Unknown / Scheduled respectively).

Subscription `type` comes from `sub.type`, fall back to populated `sub.packageId.type`.

**Why:** users reported paid:false production rows ("TRADE INN" vs paid "abyden")
showing Active; then trials (which are legitimately unpaid) would wrongly show Unpaid
if you blindly require `paid`.

**How to apply:** the helper `subStatus(sub)` in `pages/subscriptions.tsx` implements
this (buckets: Active / Expired / Unpaid / Scheduled / Unknown). Reuse/extend it.
Caveat: the upstream "Active" filter dropdown is `status`-based, so a status:true+
paid:false production row can appear under the Active filter yet badge as Unpaid —
fixing that needs a server-side filter change.
