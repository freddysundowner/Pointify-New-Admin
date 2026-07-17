---
name: Current subscription = shop.subscription pointer
description: Why "current" subscriptions must come from the shop record, not the latest subscription row.
---

# Current subscription semantics

The upstream subscriptions collection keeps EVERY payment attempt — a row is
created (unpaid, amount 0) BEFORE the M-Pesa STK push, so the latest row by
date is often an abandoned attempt.

**Rule:** the shop's in-use subscription is the one its `subscription` field
points at; upstream only re-points it on payment success / verify / extend /
assign.

**How to apply:** the proxy's `GET /api/subscriptions?current=true` composes
the current view by paging upstream `/shop/` (rows under `shops` key; each
shop's `subscription` populated incl. packageId), deduping by subscription
_id (one sub can span multiple shops), filtering proxy-side with UI-badge
status semantics (trial active = window only; production active = paid:true +
started window; `status` boolean NOT authoritative). Composed endpoint
enforces real admin auth via shared `adminAuth` directory cross-check.
