---
name: Admin edit-form semantics
description: How the admin-panel product/shop "edit everything" forms map blank/clear values to the upstream proxy.
---

# Admin edit forms (products & shops)

Comprehensive edit dialogs fetch the FULL entity first (useGetProduct / useGetShop,
enabled when open) to seed accurate current values — list rows omit many fields.
Orval query options REQUIRE a `queryKey` when you also pass `enabled`; pass
`getGet<Entity>QueryKey(id)` explicitly or typecheck fails.

## Clear vs preserve semantics (upstream uses findByIdAndUpdate(id, req.body))
- **Text/string fields:** send the trimmed value INCLUDING `""`. Blanking a string
  field then actually clears it upstream (WYSIWYG). Omitting (`undefined`) would
  silently preserve the old value — surprising for an edit form.
- **Number fields:** OMIT when blank (`undefined`). Upstream coerces numerics
  (e.g. `parseInt` on quantity), so sending `""`/null would corrupt them to NaN.
- **Category refs (shopCategoryId / productCategoryId):** "No category" must send
  `null` to DETACH, not `undefined` (undefined preserves). The spec fields are
  `nullable: true` so the generated type accepts `null`.

## Category list endpoints are GLOBAL (good for selects)
- Products: `useListProductCategories` → `/api/product-categories` → upstream
  `/product/category/`. Shops: `useListShopCategories` → `/api/shop-categories`.
- Both are unscoped global lists with no params — safe to populate edit-form
  selects. (Earlier assumption that product categories were admin-scoped was wrong.)
