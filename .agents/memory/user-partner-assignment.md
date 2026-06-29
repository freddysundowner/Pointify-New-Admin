---
name: User→partner (affiliate) assignment
description: How a platform user is linked to a partner upstream, and why reassignment needs an upstream change
---

The user→partner link is the `affliate` field (note spelling) on the upstream **Admin** model — an ObjectId → `Affliate` (the partner). It is the SAME field the partner portal/affiliate stats key off. There is a separate `referal` field (Admin→Admin peer referral) — do not confuse them.

**Where it is set upstream:** only at registration (auth.js / authentication.js `registerAdmin`), resolved from the partner's `code`. Every other reference across the upstream controllers is a read/filter (e.g. `getAdmins` `affliate` query filter, payments/shop/sales analytics).

**Key constraint — `updateAdmin` (PUT /admin/:id) DROPS `affliate`.** The controller destructures a fixed field list and builds `update` field-by-field, then `findByIdAndUpdate(id, update)`. `affliate` is not in that list, so a posted value is silently ignored.

**Why:** to let admins assign/reassign/unassign an existing user's partner, the upstream `updateAdmin` must add `affliate` handling (allow id to assign, `null`/`""` to clear). Our api-server is a stateless proxy with no DB, so it cannot persist this alone.

**How to apply (repo side, already done):** `affliate` added to `AdminUpdate` (string|null) and `Admin` (oneOf string|object|null) in openapi.yaml; admin-panel users page has an "Assign Partner" dialog (Select of partners + Unassigned) → `updateAdmin({affliate: id|null})`. The proxy `PUT /admins/:id` forwards body unchanged. The upstream `getAdmins` list returns `affliate` as a BARE id (not populated); `sanitizeAdmin` keeps it (only strips password). Render defensively: `affliate` may be a bare id string or a populated object.
