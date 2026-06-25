---
name: Admin-panel mobile page headers
description: How non-dashboard pages show a native title+back top bar on mobile while keeping desktop headers.
---

On phones the admin-panel must NOT show a big in-page `<h1>` header block below the top app bar — that reads as "a shrunk website." Instead, every page **except the dashboard** shows just its title + a back button in the fixed top app bar (native pattern). The dashboard keeps the brand top bar + its own in-page header.

- **Every non-dashboard page uses `<PageHeader>`** (`components/layout/PageHeader.tsx`) instead of a hand-rolled header div. Props: `title`, `description?` (ReactNode), `actions?` (ReactNode), `backHref?`. It renders the desktop header (`hidden md:flex`) and an actions slot that STAYS visible on mobile; the title/description are mobile-hidden because the top bar shows them.
- **Title plumbing is via React context, not a route→title map** — `MobileHeaderProvider` (`lib/mobile-header.tsx`) is mounted in `App.tsx` above `<Router>`. `PageHeader` publishes `{title, backHref}` through a `useEffect` (cleanup sets it back to null). The Shell top bar reads it. This is what lets dynamic titles work (e.g. partner-detail shows the partner's name).
- **Shell mobile top bar is conditional on `location === "/"`:** dashboard → brand; otherwise → back button + context title. Back uses `backHref` if the page set one (detail pages), else `window.history.back()` with `navigate("/")` fallback. The account avatar stays on the right on all pages.
- When adding a NEW page, render `<PageHeader title=... />` as the first child — do not write a raw `<h1 className="text-3xl ...">` header, or it will double up under the mobile top bar.

**Why:** the user explicitly rejected large per-page headers on mobile ("just have title and back button on all clicked pages, just like a mobile app, only dashboard to have that header"). The context approach (not a static title map) was chosen so detail pages with dynamic titles stay correct.
