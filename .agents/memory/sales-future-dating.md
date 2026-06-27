---
name: Sales future-dating semantics
description: How the admin-panel Sales page decides a sale is "future-dated" and how it presents them.
---

# Sales "future-dated" detection

A sale is **future-dated only when its EAT (Africa/Nairobi, UTC+3, no DST) calendar
day is later than today's EAT day** — NOT a raw instant (`ts > Date.now()`) comparison.

**Why:** The app renders all dates in EAT (`formatDateTime`/`formatDate` use
`timeZone: "Africa/Nairobi"`). A raw-instant check flags a sale timestamped later
*today* (afternoon, when it's still morning now) as "future", which confused the
Kenya-based operator who reasonably considers anything dated today as today.

**How to apply:** Compare EAT day indices: `Math.floor((ms + 3h) / 86_400_000)`.
Only `eatDayIndex(saleTs) > eatDayIndex(now)` is future. Same-day-later-time = today.

## Presentation (don't regress)
- Future-dated sales stay **inline in the normal newest-first list**, each tagged
  with an amber "Future" badge. Do NOT pull them into a hidden/collapsed-by-default
  block — upstream sorts newest-first, so a whole page can be future-dated and
  default-hiding makes the page look empty (the user explicitly rejected this).
- A top banner appears only when `futureCount > 0`: "N sales dated in the future"
  with a Show/Hide toggle. `showFuture` defaults to **false** (future-dated sales
  hidden by default), and re-hides on page change. The earlier default-visible
  behavior was reverted per the operator's request — but note this is safe ONLY
  because detection is now EAT day-granular, so default-hiding no longer empties
  a page of same-day sales.
