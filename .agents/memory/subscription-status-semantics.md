---
name: Subscription status display semantics
description: Type-aware subscription status — trials labeled by expiry; production by payment. Verified against real upstream data.
---

# Subscription status badge is TYPE-AWARE (trial vs production)

Do not badge off the bare `status` boolean. Verified real data shape (upstream
prod): trials are ALWAYS `paid:false`, `amount:0`; production is `paid:true` only
when actually paid (unpaid production = `paid:false`, often `status:false`).

`subStatus(sub)` in `pages/subscriptions.tsx` computes, in order:
1. no/invalid `endDate` -> "Unknown"
2. **trial** (`type==="trial"`, fallback populated `packageId.type`): expiry-only,
   payment-agnostic -> "Trial Expired" if past end, "Scheduled" if start in future,
   else "On Trial" (rendered with `outline` badge so a free trial is never confused
   with a paying "Active" customer).
3. **production**: "Expired" if past end, "Scheduled" if start in future, "Unpaid"
   if `paid!==true`, else "Active". Mirrors upstream shop-stats
   `isActive = paid && startDate<=now && endDate>=now`.

**Why:** users flagged unpaid production rows wrongly showing Active, and separately
wanted trials visually distinct from paying customers (a trial is "On Trial", not
"Active"). Trials legitimately never pay, so requiring `paid` for them is wrong.

**How to apply:** keep the start-date guard ABOVE the "On Trial"/"Active" returns
for BOTH branches (a future start can never be active). Caveat: the status FILTER
dropdown is upstream `status`-based, so it won't perfectly match these badge labels;
changing that needs a server-side filter change.
