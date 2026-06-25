---
name: Admin-panel mobile spacing convention
description: How padding/gaps are tightened on phones while keeping desktop spacing.
---

The admin-panel must feel compact on phones. The rule is "tighter on mobile, restore the original on desktop via `md:`":

- **Cards** (`components/ui/card.tsx`): CardHeader/Content/Footer use `p-4` on mobile and `md:p-6` from the md breakpoint (CardContent/Footer keep `pt-0` and `md:pt-0`). 16px padding on phones, 24px on desktop.
- **Page section gaps**: top-level page wrappers use `space-y-4 md:space-y-6` (not bare `space-y-6`). 16px between sections on mobile, 24px on desktop.
- `main` container in `Shell` is `p-4 ... md:p-6` already.

**Outer card flattening:** the single outer page/section Card on content & list/detail pages gets `className="page-card"`. The `.page-card` rule (in `src/index.css`, gated to `@media (max-width:767px)`, `!important`) drops the card's border/bg/shadow/radius and zeroes left/right padding of its direct children (`.page-card > *` = the CardHeader/CardContent) so content runs edge-to-edge on phones; above 768px the rule is inert and normal card chrome returns. Applied to: attendants, categories, packages, partners, products, purchases, sales, shops, subscriptions, user-shops, users, sms, partner-detail, settings. **NOT** dashboard/statistics — those are grids of stat/chart tiles where the card container is the design; flattening would merge tiles into the background. Inner mobile list-item cards are styled `div`s (not `.page-card`), so they keep their chrome.

**Dashboard compact (mobile):** dashboard keeps real Card chrome (NOT `.page-card`) since it is a stat/chart-tile grid. To compact it on phones: KPI grid is `grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4` (2-up on mobile, 4-up desktop); KPI value numbers use `text-lg ... break-words tabular-nums sm:text-xl md:text-2xl` (break-words is REQUIRED — long `formatKes` KES strings overflow the narrow 2-col cards otherwise); heading `text-2xl md:text-3xl`; revenue chart `h-[220px] md:h-[300px]`.

**Why:** user reported the mobile layout looked "squeezed" — main `p-4` + outer card `p-4` + nested item cards stacked padding three deep. Removing the outer card chrome + its horizontal padding gives a native edge-to-edge grouped-list feel. Default shadcn card `p-6` (24px) and `space-y-6` are too loose on small screens. When adding new admin pages/cards, follow the same `mobile → md:` responsive padding and use `page-card` on the outer wrapper so the look stays consistent. Desktop appearance must remain unchanged.
