---
name: AI Insights (ai-logs) upstream
description: Shape/quirks of the upstream /ai-logs domain (no source in attached_assets).
---

# AI Insights / ai-logs upstream

The `/ai-logs` domain powers the admin "AI Insights" page. There is **no upstream source
in attached_assets** for it — these shapes were derived from the live API.

- **`GET /ai-logs`** — list of automated AI insight SMS records. Filters: `adminId`, `type`
  (= `insightType`, e.g. `daily_summary`, `subscription_expiry`), `sent` (boolean), `from`,
  `to` (YYYY-MM-DD), `page`, `limit`. Returns `{success,total,page,pages,limit,data}` —
  `normalizeList` already maps `total`/`pages`/`page` to `count`/`totalPages`/`currentPage`,
  so use `proxyList`.
  Record shape: `{_id,adminId,shopId,shopName,ownerPhone,insightType,message,smsSent,
  smsError,stats:{revenue,transactions,profit,expenses},createdAt,updatedAt}`.

- **`GET /ai-logs/stats`** — NOT a list. Returns
  `{success,totals:{total,sent,failed},breakdown:[{_id:insightType,total,sent,failed,lastSentAt}]}`.
  Filters: `adminId`, `from`, `to`. Proxy it with `proxy` (forwards query), and register
  `/ai-logs/stats` BEFORE `/ai-logs` so it isn't shadowed.

**Why:** the list and stats endpoints share a prefix but have completely different shapes;
the stats one must not be normalized as a list.
