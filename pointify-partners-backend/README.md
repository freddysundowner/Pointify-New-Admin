# Pointify Partners Backend — Sub-Partners & Commission Fix

Drop-in changes for the Pointify POS backend (`pointify-leads-backend` style
handover). Copy each file over the matching file in your backend repo, review
the diff, and deploy. No database migration is needed — the new fields default
safely on existing records.

## What this changes

### 1. Commission % now comes from the admin panel (bug fix)

Previously `getAffiliateBonus` in `src/shared/functions.js` **ignored** the
per-partner `commission` field the admin sets and always paid a hardcoded 20%
(or 30% with more than 10 active users in the month; a dead `>15 → 40%` branch
never ran).

Now the payout uses the partner's own `commission` field. If it is empty/0 the
configurable base rate applies. The volume bonus is kept: when the partner's
network has more than the threshold of active production subscribers this
month, the bonus rate applies (whichever is higher than their own rate).

### 2. Commission tiers are admin-configurable

The base rate, bonus rate and threshold live in the global `Setting` collection
under the name **`AFFILIATE_COMMISSION`**:

```json
{ "baseCommission": 20, "bonusCommission": 30, "bonusThreshold": 10 }
```

The document is **seeded automatically with those defaults the first time a
commission is paid**, after which it appears in the Pointify Admin panel under
Settings and can be edited there — no code deploy needed to change rates.

### 3. Sub-partners (one level deep)

A partner can now have sub-partners:

- `Affliate.parent` — the master partner's id (null = master partner).
- `Affliate.subCommission` — the percentage **of the master's award** the sub
  receives.

When a customer referred by a **sub-partner** subscribes:

1. The total award is computed with the **master's** commission % (and the
   volume bonus counts the whole network — master + all subs).
2. The sub receives `subCommission`% of that total into their own wallet.
3. The master keeps the remainder.
4. Both get an awards record, an email and an SMS.

Customers referred by a master partner pay out exactly as before (100% to the
master). Sub-partners share their **own** referral code and log into the
partner portal with their own account.

### 4. One shared credit function

The four copy-pasted award blocks (in `controllers/subscription.js` ×2,
`controllers/webhookController.js`, `routes/mpesa.js`) are replaced by a single
`creditAffiliateAward(...)` in **`src/shared/affiliateAward.js`**. Crediting is
wrapped in try/catch so a commission failure can never break subscription
activation, and email/SMS failures never abort the wallet credit.

## Files to copy

| File | Change |
| --- | --- |
| `src/models/affliate.js` | + `parent`, + `subCommission` fields |
| `src/shared/affiliateAward.js` | **New** — shared commission logic |
| `src/controllers/subscription.js` | Both award blocks now call the shared function |
| `src/controllers/webhookController.js` | Award block replaced; `Transaction.affliateAmount` now records the partner award (before, it was overwritten by the user-referral award when both applied) |
| `src/routes/mpesa.js` | Award block replaced; same `affliateAmount` fix |

Note: these are full replacement files based on the source you provided
(July 2026). If you've changed these files since, apply the diffs instead of
overwriting.

## Required environment variable

The original `webhookController.js` you provided had the Paystack secret key
**hardcoded in source**. That key has been removed in this copy — the webhook
now reads it from the environment and rejects requests when it is missing:

```
PAYSTACK_SECRET_KEY=sk_live_...   # or sk_test_... in staging
```

Set this on the server before deploying, and consider the old hardcoded test
key exposed (rotate it in the Paystack dashboard).

## Small behavior improvements (intentional)

- Awards records are now written with a consistent shape everywhere
  (`type`, `awardType`, `shops`, `user`, `affliate`, `totalAmount`,
  `mpesaCode`, `balance`, `currency`). The "assign shops" path previously wrote
  fields (`amount`, `subscription`) that the awards schema silently dropped.
- The M-Pesa/webhook `Transaction.affliateAmount` now always records the
  partner commission, not the user-referral award.
- The Paystack webhook now also sends the partner email via the newer
  `partneraward` template through `sendEmailNew` (it used the legacy
  `sendEmail` before). Duplicate-award protection via `mpesaCode` is unchanged.

## The partner portal / admin proxy side

The Replit project adds (already done there, nothing for you to deploy):

- Portal: a "My Partners" page where a master partner creates sub-partners,
  sets their %, and suspends them. Creation uses the existing
  `/affiliates/auth/register` + update endpoints — no new upstream routes are
  required.
- Admin panel: the `AFFILIATE_COMMISSION` section appears in Settings once
  seeded and is editable with the existing generic settings editor.
