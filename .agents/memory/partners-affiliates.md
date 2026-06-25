---
name: Partners = upstream affiliates
description: How the admin "Partners" feature maps to the upstream affiliate model, and its secret-leak / auth gotchas.
---

# Partners = upstream affiliates

The admin-panel "Partners" page is the upstream **affiliate** concept (`Affliate`
model; welcome emails literally say "Partner" / "Pointify Marketing Program").
Spec exposes a clean `/partners` surface that path-remaps to upstream `/affiliates/`.

**Create uses register, not raw create.** `POST /partners` → upstream
`POST /affiliates/auth/register` (hashes password, auto-generates one if blank,
generates a referral code, dedups email → 400, **sends a welcome email**).
The raw `POST /affiliates/` (createAffiliate) stores the password in **plaintext**
(no bcrypt) so an affiliate created that way can never log in — avoid it for any
partner who needs portal access.

**Why register over create:** only register hashes the password and handles the
duplicate-email 400 (which surfaces through customFetch as an onError).

**List shape:** upstream list paginates only when `page` is sent, and uses key
`pages` (not `totalPages`) — normalizeList already handles `pages`. Each list item
is populated with related `shops` and `admins`.

## Secret-leak gotcha (important)
Upstream affiliate list/getById/update/delete responses are **unprojected** and
leak the affiliate `password` hash + `otp`/`otp_expiry`. WORSE: the list embeds
related `admins` objects which carry their **own** password/otp hashes. The proxy
must deep-sanitize: strip secrets from the partner top-level AND from each nested
`admins` entry. Stripping only top-level is not enough.

## Auth gotcha
Upstream mounts `/affiliates/` with **no token check** (whole upstream API is
open). The proxy must enforce a Bearer-token gate itself on every `/partners`
route (mirror the statistics/sms `requireBearer` 401 pattern); never rely on
upstream protection. Also strip the partner auth `token` from the register
response before returning it to the admin client.
