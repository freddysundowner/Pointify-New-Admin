---
name: List normalization contract (proxy → spec → pages)
description: Keep upstream list normalization, OpenAPI schemas, and frontend page consumption in lockstep.
---

The api-server proxies an external POS API whose list endpoints return inconsistent shapes. `proxyList`/`normalizeList` in `artifacts/api-server/src/lib/upstream.ts` coerce EVERY list response to `{ data, count, totalPages, currentPage }`.

**Rule:** any list endpoint must (1) use `proxyList` in the route, (2) declare a `*ListResult` wrapper schema in `lib/api-spec/openapi.yaml` (not a bare array, not a custom key like `logs`), and (3) be consumed in the page as `data?.data?.map(...)`. All three must agree.

**Why:** the design subagent and the spec initially diverged — some endpoints were typed as bare arrays (attendants, packages) or custom keys (`logs` for sms) while the proxy returned the wrapped object, producing empty tables at runtime that typecheck still passed.

**How to apply:** when adding a list endpoint, mirror an existing wrapped schema (e.g. `AdminListResult`), regen with `pnpm --filter @workspace/api-spec run codegen`, and read `.data`.

Also: composed/unwrapped endpoints — `/analytics/overview` returns metrics BOTH nested under `shops` and flat at top-level (dashboard reads flat `activeShops`/`trialShops`/`payingUsers`); `/subscriptions/summary` unwraps upstream `{success,data}` to the bare `{today,...,allTime}` SubscriptionSummary.
