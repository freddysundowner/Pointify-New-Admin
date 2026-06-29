---
name: List normalization contract (proxy → spec → pages)
description: Keep upstream list normalization, OpenAPI schemas, and frontend page consumption in lockstep.
---

The api-server proxies an external POS API whose list endpoints return inconsistent shapes. `proxyList`/`normalizeList` in `artifacts/api-server/src/lib/upstream.ts` coerce EVERY list response to `{ data, count, totalPages, currentPage }`.

**Rule:** any list endpoint must (1) use `proxyList` in the route, (2) declare a `*ListResult` wrapper schema in `lib/api-spec/openapi.yaml` (not a bare array, not a custom key like `logs`), and (3) be consumed in the page as `data?.data?.map(...)`. All three must agree.

**Why:** the design subagent and the spec initially diverged — some endpoints were typed as bare arrays (attendants, packages, product-categories) or custom keys (`logs` for sms) while the proxy returned the wrapped object. typecheck still passes (the generated type lies), but at runtime the data is the envelope object, not an array. Symptoms range from empty tables to a hard CRASH: `/product-categories` was speced as a bare array, so a consumer did `(categories ?? []).filter(...)` on the envelope object → `filter is not a function` thrown during render → caught by ErrorBoundary. Note this can be MISDIAGNOSED as a React "Invalid hook call" — do not chase duplicate-React / stale-Vite-cache theories; curl the endpoint and compare its real shape to the generated return type first.

**How to apply:** when adding a list endpoint, mirror an existing wrapped schema (e.g. `AdminListResult`), regen with `pnpm --filter @workspace/api-spec run codegen`, and read `.data`.

Also: composed/unwrapped endpoints — `/analytics/overview` returns metrics BOTH nested under `shops` and flat at top-level (dashboard reads flat `activeShops`/`trialShops`/`payingUsers`); `/subscriptions/summary` unwraps upstream `{success,data}` to the bare `{today,...,allTime}` SubscriptionSummary.

**Pagination clamping (out-of-range pages):** upstream does NOT clamp out-of-range pages — `/payments/transactions?page=999` returns empty `data` but still `page:999`. Both proxy styles must clamp, but differently: (a) in-memory-slice routes (`/portal/shops` fetch-all then slice) clamp `page` to `Math.min(page, totalPages)` and slice with that; (b) upstream-paginated routes (`/portal/transactions`, `/portal/users` forward page/limit) must RE-FETCH the last valid page when `page>totalPages` (clamping currentPage alone leaves data empty). Both return the clamped `currentPage`. The page mirrors server `currentPage` back into local state (useEffect) so Prev/Next resume correctly, and gates the empty-state on `count===0` (not `data.length===0`) to avoid a false "empty" flash mid-correction.
