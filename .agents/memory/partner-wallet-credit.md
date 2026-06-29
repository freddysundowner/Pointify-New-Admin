---
name: Partner (affiliate) wallet crediting
description: How admin credits a partner wallet, and the upstream update semantics that make it work
---

Partners are the upstream **Affliate** model; the balance is the `wallet` field (Number, default 0). KES currency.

**Upstream `updateAffiliate` (PUT /affiliates/:id) writes `req.body` wholesale** into `findByIdAndUpdate(id, req.body, {new:true})`. So any field in the body is set, including `wallet`. There is NO atomic increment ($inc) endpoint for affiliates.

**Why crediting is read-modify-write:** to ADD funds (not overwrite), the proxy `POST /partners/:id/credit` fetches the current wallet via GET /affiliates/:id, adds the validated amount, then PUTs `{wallet: newTotal}`. Sending a partial body only $sets that one field, so other partner fields are untouched. Accept the small lost-update race (admin-only, low concurrency) since upstream offers no atomic op.

**How to apply (money safety):** validate amount > 0 and finite on BOTH client and proxy. Fail closed on the balance: unset/null wallet → 0 (model default), but a present-yet-non-numeric wallet must reject (502), never coerce to 0 (that would wipe a real balance).

**Auth caveat:** the whole upstream is open (verifyToken is a no-op), so `requireBearer` only checks Bearer format — same as every other proxy money route. `wallet` was already mutable via the plain PUT /partners/:id, so the credit endpoint adds no new privilege; do not build a one-off auth scheme for it.
