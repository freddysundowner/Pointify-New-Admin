---
name: Pointify packages upstream
description: How the upstream packages list transforms data, and what edit forms must do to stay correct.
---

# Packages: list is lossy/transformed; edit from raw getById

The upstream `getAllPackages` (`GET /packages/`) does NOT return stored package objects faithfully:
- Returns only `status: true` packages (inactive ones are invisible in the list).
- Title shown = `newTitle || title` (the customer-facing name lives in `newTitle`).
- For `type: "production"`, the displayed `amount` is COMPUTED from a shop-tier
  pricing formula on `maxShops` (`calculateNewPriceByShops` in `shared/functions.js`:
  1000/shop at 1 shop sliding to 599/shop at 10+). The stored `amount` is returned as `oldAmount`.
- For production it also forces `durationValue=30`, `durationUnit="days"`.
- For `type: "trial"` it forces `amount=0` ("Free Trial").

**Why:** building an edit form off list rows would prefill wrong values (computed price,
forced duration, newTitle masquerading as title).

**How to apply:**
- Edit forms MUST prefill from the RAW object via `GET /packages/:id` (`getPackageById` returns
  the untransformed stored document). Use `useGetPackage(id)`, not list data.
- A single "Name" field should write BOTH `title` and `newTitle` so renames reflect in the
  transformed list display.
- `amount` editing won't visibly change production prices (formula-driven by `maxShops`);
  surface a note so operators aren't surprised.
- Spec `PackageInput`/`PackageUpdate` carry `newTitle` and `order` (added for this); upstream
  `updatePackage` also accepts `newAmount`, `newAmountusd`, `newMaxShops` (display overrides) —
  not exposed in the admin UI by default.
