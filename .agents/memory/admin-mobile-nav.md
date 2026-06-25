---
name: Admin-panel mobile-native navigation
description: How the admin-panel renders native-feeling mobile chrome and where nav items live so the two nav surfaces never drift.
---

The admin-panel is a responsive web app that must feel like a native app on phones (not a shrunk desktop site).

- **Single nav source:** all sidebar/bottom-nav destinations live in `components/layout/nav-items.ts` (`navItems`, `isNavActive`, `primaryMobileHrefs`). Both the desktop `Sidebar` (in `Shell.tsx`) and the mobile `MobileNav.tsx` import from it. Add/rename a section there once — never duplicate the list.
- **Two layouts, one shell:** desktop (`md+`) uses the shadcn `Sidebar`; mobile (`< md`) hides the `SidebarTrigger` and instead shows a top app bar (brand + account dropdown) plus a fixed bottom tab bar. The shadcn `Sidebar` renders nothing in flow on mobile (its drawer only opens when triggered), so leaving it mounted is harmless.
- **Bottom tab bar:** 5 slots = the 4 `primaryMobileHrefs` + a "More" button that opens a bottom `Sheet` listing every section. "More" is the active tab exactly when no primary tab matches the route (`moreActive = !primary.some(isNavActive)`) — drive its active color off `moreActive` alone, NOT off whether the sheet is open.
- **Native feel:** `viewport-fit=cover` in `index.html` + `env(safe-area-inset-*)` padding on the header (top) and bottom nav (bottom); `pb-24` on `<main>` so content clears the bar; tap-highlight transparent + `overscroll-behavior:none` (mobile) in `index.css`.

**Why:** the user explicitly rejected the hamburger-drawer-on-mobile look as "a minimized website." Keep the bottom-tab pattern and the shared nav source for any future admin-panel nav change.
