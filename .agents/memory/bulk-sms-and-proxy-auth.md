---
name: Bulk SMS endpoint & proxy auth derivation
description: Upstream bulk-SMS auth gap + how the proxy gates it and derives the sending admin from the JWT.
---

# Bulk SMS (`/api/sms/bulk` → upstream `/communication/bulk/sms`)

- Body contract: `{ userType, message }` required. `userType` enum: `all | trial_active | trial_expired | production_active | production_expired`.
- **Async per-user model (current upstream, rewritten 2026-06).** Upstream now dedupes to **one SMS per Admin/user** (segments root at Admin, join ALL their shops via `shop.adminId` — NOT just `primaryShop` — then `$group` by user; `all` = every admin with a phone). It accepts the job and sends in the **background**, returning **HTTP 202** immediately `{ message, userType, total, status:"processing" }`; empty audience → **200** `{ total:0 }`; bad input → **400**. It no longer returns final `sent`/`failed` (delivery shows up in SMS logs).
- Proxy just **forwards natively** (no more 4-way `all` fan-out) — `proxy()` passes the 202 through, and the generated client's `customFetch` treats any `response.ok` (incl. 202) as success. UI keys its toast off `total` only ("sending in background"), audiences are labelled **users** not shops.
- **History (pre-2026-06):** old upstream looped Admins by `primaryShop` only (skipped null-primaryShop users), had no `all`, returned synchronous `{ total, sent, failed }` (200 even if all failed), and had a `sendSms(phone,…)` undefined-var bug that failed every send. The rewrite (which the user deploys to their own upstream) fixed all of that. Never fire a real bulk send to "test".

## Upstream auth reality (snapshot in attached_assets) — IMPORTANT
- The upstream auth middleware `middleware/auth.js` `verifyToken` is **disabled**: its first line is `return next();`. So **every upstream route accepts any/no token** — even routes "protected" by `verifyToken` (`/shop`, `/subscriptions`, `/counts`, …). There is therefore **no upstream endpoint that validates a token**, so the proxy cannot validate a token by calling upstream.
- We do **not** hold the upstream JWT secret (`process.env.jwtsecret`) and should not. Cryptographic signature verification is therefore **not achievable** from this stateless proxy. A deliberately forged but well-formed JWT cannot be fully rejected — this is a fundamental limit, and the upstream itself is wide open regardless of our proxy.
- The route `POST /communication/bulk/sms` has no auth middleware at all (anonymous reaches the controller).
- The controller `sendBulkSmsByUserType` has a latent bug: it calls `sendSms(phone, ...)` / `contact: phone` with an **undefined `phone`** (should be `admin.phone`), so every send throws → caught → `failed++`. Per the snapshot, no real SMS goes out. Live upstream may differ — never fire a real bulk send to "test".

## Proxy decisions (our code)
- `/api/sms/bulk` gate = **strongest achievable without the secret**: require that the bearer token **decodes to an admin id** via `adminIdFromAuth` (else 401). This rejects missing/malformed/non-JWT tokens (`Bearer junk` → 401) and guarantees attribution. It cannot stop a forged-but-decodable JWT — accept that limit.
- The derived id is injected as `user`; any **client-supplied `user` is stripped** (anti-spoof for the communication audit log). Upstream login token payload is `{ email, _id }` (other flows sign `{ id }`) — decode the JWT middle segment (base64url) and read `_id ?? id`. So `BulkSmsInput` in the spec is just `{ userType, message }`; do not add `user` to the spec.

**Why:** client-supplied sender id is spoofable; upstream attributes `user` only from the request body (not the token), so the proxy must inject it from the (decoded) token.

## Stronger gate for persisted public content (What's New, etc.)
- For writes whose effect is **persistent + publicly visible** (e.g. editing the /whats-new page), decode-only is not enough: also **cross-check the token's `{_id, email}` against the upstream admin directory** (`GET /admin/?name=<email>`, match `_id` AND `email` case-insensitively; cache success ~5 min). Forged tokens then need both a real admin's id AND email.
- **Why:** decode-only lets anyone deface a public page; the directory cross-check is the strongest gate achievable without the upstream JWT secret.
- **How to apply:** reuse this pattern for any future proxy endpoint that stores content locally rather than forwarding to upstream.
