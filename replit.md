# Pointify Admin

A platform/super-admin panel for Pointify POS. A web admin frontend plus an Express API server that **proxies** to the user's existing Pointify POS API at `https://api.pointifypos.com`. Operators sign in and manage shops, users, products, subscriptions, SMS, and view revenue analytics across the whole platform.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API/proxy server
- `pnpm --filter @workspace/admin-panel run dev` — run the admin web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Optional env: `POS_API_BASE_URL` — upstream POS API base URL (defaults to `https://api.pointifypos.com`). Not a secret.
- Optional env: `POS_PACKAGES_REF_USER_ID` — a user id with an **active production subscription**, injected on the packages list so upstream returns the full catalog including the `trial` package (see Gotchas). Not a secret. If the trial package ever disappears from the list, this user likely lost their production subscription — point the var at another such user.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + wouter + TanStack Query + shadcn/ui (artifact `admin-panel`, served at `/`)
- API: Express 5 stateless proxy (artifact `api-server`, served at `/api`)
- Validation/codegen: Zod + Orval from `lib/api-spec/openapi.yaml`
- No database — the server is a stateless proxy; all data lives upstream.

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml`
- Generated hooks/schemas: `lib/api-client-react/src/generated/` (import from `@workspace/api-client-react`)
- Proxy core: `artifacts/api-server/src/lib/upstream.ts` (`proxy`, `proxyList`, `normalizeList`, `upstreamFetch`)
- Proxy routes: `artifacts/api-server/src/routes/*` (one file per domain, mounted in `routes/index.ts`)
- Frontend pages: `artifacts/admin-panel/src/pages/*`; auth context: `src/lib/auth.tsx`; layout: `src/components/layout/Shell.tsx`

## Architecture decisions

- **Stateless proxy, no DB.** The server forwards requests to the upstream POS API and returns responses. The browser stores the auth token in `localStorage` (`pointify_token`) and the generated client attaches `Authorization: Bearer <token>` via `setAuthTokenGetter`.
- **Auth is upstream**, not Clerk: `POST /api/auth/login` proxies to upstream `POST /auth/login`.
- **List normalization:** upstream list endpoints return inconsistent shapes, so `proxyList`/`normalizeList` coerce them to `{ data, count, totalPages, currentPage }`.
- **Analytics is composed server-side** (`/api/analytics/overview`) from upstream `/subscriptions/summary/stats`, `/shop/stats/metrics`, and admin counts.
- **Path remapping:** clean REST paths in the spec (e.g. `/subscriptions/{id}/extend`) map to upstream's actual paths (e.g. `/subscriptions/extend/{id}`). See each route file.

## Product

Operator-facing pages: dashboard analytics, users/admins, shops + shop categories, products + categories, attendants, sales, purchases, packages, subscriptions (extend/delete + revenue), SMS (bulk by audience, top-up, logs, communications), and global settings.

## Gotchas

- The upstream has **no get-admin-by-id endpoint**; `/api/admins/{id}` fetches the admin list and finds the match.
- Relation fields (adminId, shopId, packageId, etc.) come back as either populated objects or bare id strings — render defensively.
- Generated client paths are absolute `/api/...` and route through the shared proxy; do not set a base URL for the web app.
- The upstream packages list **hides the `trial` package** unless the request's `id` query param is a user with a production subscription. The `/api/packages` proxy injects `POS_PACKAGES_REF_USER_ID` to force the full catalog. Because that reference user is in the `old` pricing group, production rows show raw stored amounts (not computed tiers) — fine here since the list is display-only and edit forms prefill from raw `getById`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
