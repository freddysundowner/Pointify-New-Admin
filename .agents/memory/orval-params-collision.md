---
name: Orval params name collision
description: Why API endpoints with both a path param and required query params break api-zod codegen, and how to avoid it.
---

An endpoint that has BOTH a path parameter AND query parameters makes orval
generate a zod schema named `<Operation>Params` (in `lib/api-zod/src/generated/api.ts`)
AND a TypeScript type named `<Operation>Params` (in the schemas/types module). The
api-zod barrel (`export * from "./generated/api"; export * from "./generated/types"`)
then re-exports the same name twice → `tsc --build` fails with TS2308 ("has already
exported a member named ...") and `pnpm --filter @workspace/api-spec run codegen`
exits non-zero at its `typecheck:libs` step (the hooks still get written first).

**Why:** orval names query-only param schemas `<Op>QueryParams` but path-only /
path+query schemas `<Op>Params`, which collides with the always-`<Op>Params` type.
Existing repo endpoints never hit this because they are either query-only or
path-only.

**How to apply:** don't mix a path param with required query params in one spec
path. Pass the id as a query param instead (e.g. `productId`) and remap to the
upstream path segment inside the proxy route. This keeps the generated name
`<Op>QueryParams` distinct from the `<Op>Params` type.
