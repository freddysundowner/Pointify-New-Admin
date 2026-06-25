---
name: Bulk SMS endpoint & proxy auth derivation
description: Upstream bulk-SMS auth gap + how the proxy gates it and derives the sending admin from the JWT.
---

# Bulk SMS (`/api/sms/bulk` → upstream `/communication/bulk/sms`)

- Body contract: `{ userType, message }` required. `userType` enum: `trial_active | trial_expired | production_active | production_expired` (targets Admins by their primaryShop's subscription type + endDate). Empty audience → HTTP 200 with `{ total: 0 }`, nothing sent.
- Result shape: `{ message, userType, total, sent, failed }`. **Treat `total>0 && sent===0` as a failure in the UI** — upstream returns 200 even when every recipient fails.

## Upstream auth reality (snapshot in attached_assets) — IMPORTANT
- The upstream auth middleware `middleware/auth.js` `verifyToken` is **disabled**: its first line is `return next();`. So **every upstream route accepts any/no token** — even routes "protected" by `verifyToken` (`/shop`, `/subscriptions`, `/counts`, …). There is therefore **no upstream endpoint that validates a token**, so the proxy cannot validate a token by calling upstream.
- We do **not** hold the upstream JWT secret (`process.env.jwtsecret`) and should not. Cryptographic signature verification is therefore **not achievable** from this stateless proxy. A deliberately forged but well-formed JWT cannot be fully rejected — this is a fundamental limit, and the upstream itself is wide open regardless of our proxy.
- The route `POST /communication/bulk/sms` has no auth middleware at all (anonymous reaches the controller).
- The controller `sendBulkSmsByUserType` has a latent bug: it calls `sendSms(phone, ...)` / `contact: phone` with an **undefined `phone`** (should be `admin.phone`), so every send throws → caught → `failed++`. Per the snapshot, no real SMS goes out. Live upstream may differ — never fire a real bulk send to "test".

## Proxy decisions (our code)
- `/api/sms/bulk` gate = **strongest achievable without the secret**: require that the bearer token **decodes to an admin id** via `adminIdFromAuth` (else 401). This rejects missing/malformed/non-JWT tokens (`Bearer junk` → 401) and guarantees attribution. It cannot stop a forged-but-decodable JWT — accept that limit.
- The derived id is injected as `user`; any **client-supplied `user` is stripped** (anti-spoof for the communication audit log). Upstream login token payload is `{ email, _id }` (other flows sign `{ id }`) — decode the JWT middle segment (base64url) and read `_id ?? id`. So `BulkSmsInput` in the spec is just `{ userType, message }`; do not add `user` to the spec.

**Why:** client-supplied sender id is spoofable; upstream attributes `user` only from the request body (not the token), so the proxy must inject it from the (decoded) token.
