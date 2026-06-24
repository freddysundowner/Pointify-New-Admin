---
name: Responsive list-page pattern
description: How admin-panel list pages adapt to mobile (table vs cards)
---

# Responsive list pages (admin-panel)

Every list page renders data twice from the SAME query result:
- Desktop: the shadcn `<Table>` wrapped in `<div className="hidden md:block">`.
- Mobile: a parallel `<div className="space-y-3 md:hidden">` mapping each row to a
  card (`rounded-lg border bg-card p-4 shadow-sm`): identifying field(s) + a
  right-aligned badge/actions in a flex header, then a labeled `<dl>` grid using the
  same column labels.

**Why:** the shadcn sidebar already collapses to a drawer and tables already
horizontal-scroll, but the user wanted a real "mobile app" feel, so rows reflow into
stacked cards on phones (breakpoint 768px via `use-mobile`).

**How to apply:** when adding/editing a list page, keep both views in sync (a field or
action change must be made in both). For repeated row actions, extract a shared
component (see `UserActions` in `users.tsx`) to avoid table/card drift. Shell-level
mobile chrome (sticky app-bar, mobile-only brand, `p-4 md:p-6`) lives in
`components/layout/Shell.tsx`.
