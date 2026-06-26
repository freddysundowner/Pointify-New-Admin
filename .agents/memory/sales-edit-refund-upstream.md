---
name: Sales date-edit & refund upstream semantics
description: How the proxy safely exposes upstream sale date-edit (updateSale) and item refund (createSaleReturn), and the side-effect traps to avoid.
---

# Sales date-edit & item refund

Two admin actions on a sale receipt, both proxied (no DB):

- **Edit date** → upstream `PUT /sales/:id` (updateSale). Spec op `updateSaleDate`, body `{createdAt}`.
- **Refund items** → upstream `POST /salereturns/` (createSaleReturn). Spec op `createSaleReturn`, proxy path `POST /sales/:id/returns`, body `{items:[{product,quantity}], reason?}`.

## Side-effect traps (why the guards exist)

- updateSale only safely updates plain fields through its `status === "cashed"` branch. For **hold** sales that branch DEDUCTS from the customer wallet; other statuses fall through to a full inventory recompute. **Why:** so the proxy hard-guards date edits to `status === "cashed"` receipts and always resends `status:"cashed"` + ISO `createdAt`. Never let a non-cashed sale through the date-edit path.
- createSaleReturn needs `shopId` + `attendantId`. **Resolve these server-side from the fetched sale, never trust the client** — otherwise restock/return record is misattributed.

## Refund math & quantities

- Refund value: `manageByPrice` lines prorate `(returnQty/sold)*unitPrice`; discrete lines use `returnQty*unitPrice`.
- **manageByPrice (sold by weight/value) lines may be returned in fractional qty; discrete lines are whole units only.** UI enforces `step="any"` vs `step=1` and validates integer-ness per line. Do NOT blanket `Math.floor` all quantities — it silently under-refunds/ drops weighted returns.

## Proxy hygiene learned here

- After the pre-fetch `fetchSale()` guard, forward upstream errors verbatim: `status===404` → "not found"; **`status>=400` → forward upstream status+body**. Otherwise a 401/403/5xx gets masked as a misleading local 422 ("not cashed" / "missing shop").
- **Aggregate refund items by product id before forwarding** (sum duplicates). Per-item validation alone doesn't stop a crafted payload with repeated product ids from distorting upstream refund math/stock.

## Failure-surfacing

- custom-fetch throws `ApiError` on non-2xx → caught in `onError`. Also money-op 200-failure contract: check `res.error` in `onSuccess` and treat as failure.
