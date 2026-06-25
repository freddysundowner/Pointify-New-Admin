---
name: Shop categories upstream
description: Quirks of the upstream /shop/category endpoints and how the proxy/spec/UI must treat them.
---

# Shop categories upstream (`/shop/category`)

- **List is a bare array, not paginated.** `getAllShopCategories` returns a plain
  `ShopCategory[]` when no `page` query is sent. The proxy GET `/api/shop-categories`
  must use plain `proxy()` (NOT `proxyList`, which would wrap in `{data,...}`), so the
  response matches the spec's `ShopCategory[]` and the UI consuming `data ?? []` directly.
  **Why:** mixing in `proxyList` produced a shape mismatch / latent crash.

- **Create returns HTTP 201 even on a duplicate name**, with body
  `{ error: "category with that name already exists" }`. There is NO error status code.
  **How to apply:** in the client `onSuccess`, detect a string `result.error` and surface
  it as a failure toast; do not rely on `onError` for duplicates.

- Update returns 200 or 404 `{error}`; delete returns 204 (no body — fine for customFetch).

- Category objects also carry `active`, `__v`, `sync` fields upstream; the spec models
  only `{_id, name}` and the UI renders just the name. Names often have trailing spaces.
