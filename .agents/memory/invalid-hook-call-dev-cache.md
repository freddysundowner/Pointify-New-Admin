---
name: "Invalid hook call" in admin-panel dev preview
description: When a React "Invalid hook call" appears in the dev preview but the component code and deps are provably correct, suspect a stale Vite optimize cache, not a code bug.
---

# "Invalid hook call" with provably-correct code = stale Vite dev cache / HMR glitch

If the Vite dev preview throws `Invalid hook call ... occurred in the <SomeComponent>` and ErrorBoundary catches it, but auditing shows the component's hooks are all unconditional/top-level, **do not assume a Rules-of-Hooks bug.** First rule out the three React-listed causes, then treat it as an environmental dev-server glitch.

**Why:** Hit this on `ProductEditForm` (admin-panel products edit dialog). The component, `EditProductDialog`, `useToast`, the generated `useUpdateProduct`, and all helpers were correct. There was a single `react`, `react-dom`, and `@tanstack/react-query` on disk (`node_modules/.pnpm`) AND in Vite's optimize cache (`node_modules/.vite/deps/_metadata.json`), `resolve.dedupe` already listed react/react-dom, and every Radix dep the dialog uses was already optimized. The error fired once ~8 min into a session — the signature of a stale/corrupt optimize cache or a Fast-Refresh dispatcher glitch, not a reproducible defect.

**How to apply (fast triage, in order):**
1. Audit the named component for conditional hooks / early returns before hooks — usually clean.
2. Confirm single React: `find node_modules/.pnpm -maxdepth 1 -type d -name 'react@*' -o -name 'react-dom@*'` and the single `@tanstack+react-query@*_react@*` entry.
3. Check the per-app Vite cache `artifacts/<app>/node_modules/.vite/deps/_metadata.json` lists ONE react/react-dom/react-query and includes the deps the failing view uses.
4. If 1–3 are clean, the fix is to force a fresh optimize: `rm -rf artifacts/<app>/node_modules/.vite` then restart that app's workflow. Tell the user to hard-refresh (Cmd/Ctrl+Shift+R).
5. Only if it still reproduces after a hard refresh on a freshly re-optimized server is it a real code/dep bug worth deeper digging (and you'll likely need to reproduce while logged in).
