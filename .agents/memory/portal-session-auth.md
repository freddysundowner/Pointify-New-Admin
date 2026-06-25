---
name: Partner portal session auth
description: Why the proxy mints its own signed session token for the partner portal instead of trusting the upstream affiliate JWT.
---

# Partner portal session auth

The partner portal (`/portal/*` proxy routes) gates every authed endpoint on a
**proxy-signed** HS256 session token, NOT on an id decoded from the upstream
affiliate JWT.

**Why:** the upstream POS API mounts `/affiliates/` and `/payments/` with no auth
check (verifyToken is a no-op), and the proxy does not hold the upstream JWT
secret, so it cannot verify the upstream token's signature. If a `/portal/*`
route derived the affiliate id by base64-decoding an unverified client-supplied
JWT (the pattern `sms.ts` uses for admin actions), anyone could forge a token
carrying another partner's id and read their data or trigger a **real M-Pesa
withdrawal** from their wallet (IDOR / account takeover). Admin-side routes accept
this risk because the upstream is open regardless; the partner portal cannot,
because it is the sole gate over per-partner money and PII.

**How to apply:**
- At login/register, decode the upstream-issued token ONCE (trusted: it came from
  the upstream response, not the client) to get the affiliate id, then mint a
  token signed with `SESSION_SECRET` carrying `{ aid, ut }` and return THAT as the
  response `token` (the client never sees the upstream token).
- Every protected route verifies signature + expiry + presence of `aid`
  (timing-safe compare) and uses `session.aid` for all data access — never a
  client value. The embedded upstream token (`session.ut`) is forwarded upstream
  as the bearer for parity if upstream ever starts enforcing.
- `SESSION_SECRET` is a hard dependency: `index.ts` fails fast at startup if it is
  unset, otherwise the portal fails closed (logins 502, protected routes 401).
- Server-composed endpoints like `/portal/summary` must fail closed: if any
  upstream call returns >= 400, return an error rather than synthesizing zero
  metrics that look like real (empty) data.
