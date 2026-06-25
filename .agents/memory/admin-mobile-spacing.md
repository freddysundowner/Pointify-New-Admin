---
name: Admin-panel mobile spacing convention
description: How padding/gaps are tightened on phones while keeping desktop spacing.
---

The admin-panel must feel compact on phones. The rule is "tighter on mobile, restore the original on desktop via `md:`":

- **Cards** (`components/ui/card.tsx`): CardHeader/Content/Footer use `p-4` on mobile and `md:p-6` from the md breakpoint (CardContent/Footer keep `pt-0` and `md:pt-0`). 16px padding on phones, 24px on desktop.
- **Page section gaps**: top-level page wrappers use `space-y-4 md:space-y-6` (not bare `space-y-6`). 16px between sections on mobile, 24px on desktop.
- `main` container in `Shell` is `p-4 ... md:p-6` already.

**Why:** user reported "a lot of unnecessary spaces and padding" on mobile. Default shadcn card `p-6` (24px) and `space-y-6` are too loose on small screens. When adding new admin pages/cards, follow the same `mobile → md:` responsive padding so the look stays consistent. Desktop appearance must remain unchanged.
