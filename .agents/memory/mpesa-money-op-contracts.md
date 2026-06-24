---
name: M-Pesa money-op response contracts
description: How upstream withdraw (B2C) and createSubscription (STK push) signal success/failure — failures arrive inside HTTP 200, so 2xx is NOT success.
---

Upstream returns M-Pesa gateway results directly, and a failed payment can come back with **HTTP 200**. Never treat a 2xx mutation response as success for these endpoints — inspect the body.

## createSubscription (STK push — "send payment prompt")
Upstream `POST /subscriptions/` → our `POST /api/subscriptions`. The body is the STK push result:
- `{ status: 200, message: "waiting", data }` → prompt **sent** to the customer's phone (success).
- `{ status: 200, message: "failed", data }` → gateway **rejected** (ResponseCode != 0) — this is a FAILURE despite 200.
- `{ status: false, message: "Error happened, check phone number...", error }` → upstream exception (bad phone, etc.) — FAILURE.
- Validation errors (e.g. too many shops) come back non-2xx → land in mutation `onError`.

Success test used in UI: `status !== false && message !== "failed"`.

## withdrawAmountMpesa (B2C — "withdraw")
Upstream `POST /payments/mpesa/withdraw` → our `POST /api/payments/withdraw`. Requires `pin === "1122"`; a wrong pin returns **HTTP 200** with `{ status: false, message: "Invalid Pin" }`. Handle `status === false` as failure in `onSuccess`.

**Why:** the architect caught a false-positive where a failed STK push was toasted as "sent". The upstream STK helper (`shared/functions.js` sendMpesaStkPush) maps `ResponseCode == 0 ? "waiting" : "failed"` and only throws to the `status:false` branch on an axios exception.

**How to apply:** any new UI/route touching these (or other M-Pesa) endpoints must branch on the body, not the HTTP status. Money ops are never live-tested per project rules — get the contract from `attached_assets/pointifyposapi_extracted/`.
