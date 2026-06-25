---
name: Revenue range computation & analytics auth
description: How to compute custom-range subscription revenue to match upstream, and the auth guard composed analytics endpoints need.
---

# Revenue definition (mirror upstream)

Upstream `getSubscriptionSummary` (controllers/subscription.js) defines revenue as
`{$sum: "$amount"}` over subscriptions whose `createAt` falls in the period —
**no `paid` filter** — using **UTC day boundaries** (`Date.UTC(...)`, `$gte start, $lt end`).

**How to apply:** any custom date-range revenue total must sum `amount` over
`createAt ∈ [from 00:00Z, (to+1day) 00:00Z)` with NO paid filter, and use UTC
(not EAT) day boundaries so a custom range matching a fixed bucket period
(today/thisWeek/thisMonth) yields identical totals to the upstream summary cards.

**Why:** the StatisticsResult revenue buckets come from upstream and are UTC-based;
computing a range in EAT (UTC+3) makes the same calendar period disagree with the cards.

# Data source

`/subscriptions/` returns the **full array of all subscriptions when no `page`
query is sent** (`getAllSubscriptions`: `hasPagination = !!page`; without it, no
skip/limit). So range revenue is computed proxy-side by fetching that full list
and filtering by `createAt` — there is no native createAt-range filter upstream
(only single-day `createAt`).

# Auth guard for composed analytics endpoints

Some upstream endpoints (e.g. `/subscriptions/`) are **permissive** and return
data even without a valid bearer. Composed proxy endpoints that aggregate them
(revenue, analytics) must **enforce bearer presence at the proxy** (401 if
missing) instead of relying on upstream, or they leak platform aggregates
publicly.

**Why:** an architect review caught `/api/statistics/revenue` returning real
revenue totals with no Authorization header because the upstream list it reads
was unauthenticated.
