---
name: Upstream sales & purchases list pagination
description: How the Pointify upstream paginates sales and purchases, and the response-shape quirks the proxy must absorb.
---

- Sales list = upstream `GET /sale/filter` (`getSales`). Paginates only when `page` is present (uses `limit || 10`). Paginated response is already the normalized shape `{ data, count, totalPages, currentPage }`; without `page` it returns `{ sales: [...] }`.
- Purchases list = upstream `GET /purchase/` (`getAllPurchases`). Paginates only when **both** `page` AND `limit` are present. Paginated response is `{ purchases, page, limit, total }` — it has **no** `totalPages`. Without page+limit it returns a bare array.
- Both populate `attendantId` with `username` only and `shopId` with `name` only; both sort `createdAt` desc.

**Why:** the two endpoints use different pagination triggers and different response shapes, so a single client call style needs the proxy to absorb the difference.
**How to apply:** the frontend must always send both `page` and `limit` (purchases ignores page alone). `normalizeList` derives `totalPages = ceil(count/limit)` when `totalPages` is absent but `limit` is present, so the purchases shape paginates correctly. Render attendant/shop defensively (populated object OR bare id string). The real timestamp field is `createdAt` — the spec's `createAt` is a legacy typo; read `createdAt ?? createAt`.

## Filters (getSales / getAllPurchases)

- Sales filters: `receiptNo` (regex), `status`, `paymentType`, `start`+`end` (date range on createdAt, both required together — upstream gates on `if(start && end)`), `attendantId`, `customerId`, `shopId`. **Param names are `start`/`end`, NOT `startDate`/`endDate`** (those were dead params).
- **Sales payment quirk:** `getSales` destructures `paymentTag = "cash"`, so when NO `paymentType` is sent it falls into the cash branch (`paymentTag in [cash,split]` + `amountPaid>0`), silently hiding mpesa/bank/credit sales. To get a TRUE "all payments" list, send an explicit empty `paymentTag=""` — the proxy/generated client serializes empty strings (`value !== undefined`), and upstream's `if (paymentTag && ...)` then skips the branch. Sending a specific `paymentType` takes the first branch and ignores paymentTag.
- Purchases filters: `purchaseNo` (regex), `paymentType`, `start`+`end`, `supplierId`, `attendantId`, `shopId`, `name` (shop-name regex). **Purchase paymentType is binary, not literal:** `paymentType="credit"` ⇒ `outstandingBalance>0`; ANY other value ⇒ settled branch (`outstandingBalance<=0`). So model the UI as "Credit (unpaid)" vs "Settled" (send `cash` for settled), not as literal cash/mpesa/bank.
