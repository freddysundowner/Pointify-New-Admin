---
name: Sub-partners (one-level affiliate network)
description: How sub-partner accounts work across upstream, proxy, and portal — creation flow, escalation guards, and award split.
---

Sub-partners are affiliates with `parent` (master id) + `subCommission` (% OF the master's award). One level deep only.

**Creation has no dedicated upstream route** — the proxy reuses `/affiliates/auth/register` (emails welcome + password) then `PUT /affiliates/:id {parent, subCommission}`, with a DELETE rollback if linking fails. Ownership checks live entirely in the proxy against `session.aid`; upstream has no parent filter, so the sub-partner list fetches all affiliates and filters by parent.

**Escalation guards:** `parent` and `subCommission` must stay stripped from portal self-register AND `PUT /portal/me` — otherwise a sub could detach itself or raise its own share.

**Why:** upstream affiliate routes are permissive; the proxy is the only authz layer.

**Award split** (upstream deliverable `shared/affiliateAward.js`): total award computed with the MASTER's commission % (network volume counts master + subs), sub gets `subCommission`% of it, master keeps the remainder; both get awards records + email/SMS. Tiers come from Setting `AFFILIATE_COMMISSION` `{baseCommission:20, bonusCommission:30, bonusThreshold:10}`, auto-seeded on first payout.

**How to apply:** any new portal route touching affiliate records must derive identity from the proxy session and strip account-control fields; never trust client-sent parent/subCommission/commission/wallet.

Also: the user's original upstream `webhookController.js` had a hardcoded Paystack secret — the deliverable copy reads `PAYSTACK_SECRET_KEY` from env and fails closed; the old test key should be rotated.
