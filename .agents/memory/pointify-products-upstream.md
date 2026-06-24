---
name: Pointify products upstream quirks
description: Non-obvious upstream POS API facts for the admin Products page (search, dates, inventory)
---

# Products list endpoint choice
- Use upstream `GET /product/admin/products` (controller `getProducts`) for the admin product list. It supports `name` (product-name regex), `shop` (shop-NAME regex), `shopid` (exact id), populates shopId/supplierId/attendantId, sorts `date:-1`, returns `{ data, totalDoc, limits, pages }`.
- Do NOT use `/product/` (`getAllProducts`) for the admin list: without `shopid` it returns every product across all shops and is very slow (curl timeouts are upstream latency, not a proxy bug).
- `shopid` overrides `shop` name filter upstream. **How to apply:** when the page is shop-scoped (shopid from Shops dropdown), hide the shop-name search box.

# Product dates
- The Mongoose Product model has NO `timestamps` and the `markUnsynced` plugin does NOT add them. Products only have `date` (creation). There is NO real `updatedAt` on products.
- **How to apply:** "Date added" = `createdAt ?? date`; "Updated" = `updatedAt` with a `—` fallback (usually empty). Inventory/Batch models DO have `createdAt`.

# Inventory expand
- The list endpoint does NOT populate `batches`. To show a product's inventory, lazily fetch `GET /api/products/:id` (`getProductById` → `populateProductFields`) which populates `batches` (lot-level: batchCode, quantity, totalQuantity, buyingPrice, expirationDate, createdAt).
- There is no list-inventories-by-product REST endpoint upstream.

# normalizeList
- `normalizeList` (api-server/src/lib/upstream.ts) must include `totalDoc` (count) and `pages` (totalPages) candidates to read the getProducts response shape.
