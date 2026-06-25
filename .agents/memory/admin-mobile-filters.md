---
name: Admin-panel mobile filter sheet
description: How list-page filters collapse into a bottom sheet on mobile without duplicating inputs.
---

On phones the admin-panel list-page filter rows must NOT sit inline eating vertical space — they collapse behind a "Filters" button that opens a bottom Sheet.

- **Component:** `components/layout/FilterBar.tsx`. Props: `children` (the filter fields), `className` (the desktop inline-row layout, passed by the page), `active?` (shows a dot on the mobile trigger), `title?`.
- **Render-once rule (important):** FilterBar branches on the runtime `useIsMobile()` hook and renders `children` in exactly ONE place — inline `<div className>` on desktop, or inside `<SheetContent side="bottom">` on mobile. Do NOT implement this with two copies gated by `hidden md:`/`md:hidden`: the filter inputs are controlled and have `id`s, so duplicating them creates duplicate DOM ids and double-bound controls.
- **Usage per page:** replace the existing filter-row `<div className="...">…fields…</div>` with `<FilterBar className="…same classes…" active={hasAnyFilter}>…fields…</FilterBar>`. Keep the `Clear` button and conditional fields (e.g. `{!shopId && …}`) INSIDE as children.
- **Keep OUTSIDE FilterBar:** `ShopFilterBanner` and helper/hint `<p>` text — they belong in page flow, not in the sheet.
- Pages wired: users, shops, subscriptions, sales, purchases, products. **attendants is intentionally left inline** (a single compact search box isn't worth a sheet, and search-in-sheet hides live results behind the overlay).

**Why:** user asked filters to "open as bottom sheet on mobile, so that they stop occupying a lot of space." The render-once approach was chosen specifically to avoid duplicate-id / double-state bugs that the simpler hidden/visible-duplication approach would cause.
