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

## Shops-per-partner count: fix upstream, never N+1
A partner's true shops = shops whose OWNER (shop.adminId) was an admin that partner
referred (admin.affliate). The affiliate record's own `affliate`-tagged shops are
rarely set and badly undercount; the embedded `admins` array is already accurate
(so userCount = admins.length is free).
**Decision:** the correct, scalable fix lives in the UPSTREAM `getAllAffiliates`
controller (compute attribution there in batched queries), and the proxy stays a
single `/affiliates/` call deriving counts from embedded arrays.
**Why:** the user explicitly rejected a proxy-side per-partner fan-out ("too many
requests") — do NOT reintroduce one-call-per-partner, even as a fallback.
**Watch out:** counts are only correct once the upstream controller change is
actually deployed to api.pointifypos.com; a stale upstream silently undercounts shops.

## Partner-scoped data (shops / users / transactions)
- **Referred shops** = `GET /shop/?affliate=<affId>` (`totalShops`); **referred users** =
  `GET /admin/?affliate=<affId>` — both upstream list endpoints honor the `affliate`
  query param and resolve it to admins referred by that affiliate. The proxy just
  passes `affliate` through on `/shops` and `/admins`.
- **Transactions** = `GET /payments/transactions?id=<affId>` (id filters by affiliate),
  returns `{success,total,page,limit,totalPages,data}`; `type` is `subscription`
  (commission, `affliateAmount`) or `withdraw`. Populated `affliate` carries secrets —
  strip them; also strip `user` defensively (upstream only projects username/phone).
- Spec path uses `/partners/transactions?id=` (id as QUERY param, NOT a path param)
  to dodge the orval `<Op>Params` name collision; proxy route must be registered
  BEFORE `/partners/:id` so the literal segment isn't captured by the dynamic id.

## Known authz gap (pre-existing, app-wide)
`/admins`, `/shops`, `/products`, `/sales`, etc. have NO proxy bearer gate — only
`/partners*`, `/statistics*`, `/analytics*`, `/sms/bulk` do. The frontend is
auth-gated and always sends a token, but the API itself is open (upstream is fully
open too). Filtering these by `affliate` exposes nothing new. A real fix is an
app-wide auth middleware (skip `/auth/login`,`/healthz`), which is a separate
decision — don't silently bolt it onto a feature task.

## Auth gotcha
Upstream mounts `/affiliates/` with **no token check** (whole upstream API is
open). The proxy must enforce a Bearer-token gate itself on every `/partners`
route (mirror the statistics/sms `requireBearer` 401 pattern); never rely on
upstream protection. Also strip the partner auth `token` from the register
response before returning it to the admin client.
