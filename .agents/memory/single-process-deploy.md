---
name: Single-process production deploy (PM2)
description: How admin + partner + /api are served by one pointify-api Node process in production, and why deploy-production.sh uses PM2 + nginx-proxy-everything.
---

# Single-process production serving

In production the admin panel, the partner portal, AND the `/api` proxy are all
served by ONE Node process named `pointify-api` (the api-server artifact). It is
NOT static files in `/var/www`.

- **How:** `api-server` mounts `/api` first, then `mountSpa()` (lib/spa.ts)
  serves the built SPAs host-based: a partner host (`host === "partner"` or
  `startsWith("partner.")`) gets `partner-portal/dist/public`; every other host
  (admin.* or unknown) gets `admin-panel/dist/public`. Routing is **strict** —
  never cross-serve the other portal if one build is missing (just `next()`),
  to keep host→build deterministic. SPA fallback sends `index.html`; `/api` is
  always bypassed so the proxy is never shadowed.
- **Build dirs** resolved from `ADMIN_DIST` / `PARTNER_DIST` env (deploy sets
  them to the repo `artifacts/*/dist/public`); fallback is relative to the
  bundle (`__dirname/../../<artifact>/dist/public`). If neither build exists
  (local dev, where Vite serves the front-ends), mountSpa no-ops with a warning.

## Why PM2, not systemd

**Why:** the user's VPS runs every app under PM2 (root). A systemd unit would be
inconsistent with their ops model and invisible in `pm2 ls`. `deploy-production.sh`
therefore runs `pointify-api` under PM2.

**How to apply / gotchas:**
- nginx proxies ALL traffic (`location /`, not just `/api`) to
  `127.0.0.1:$API_PORT` for both subdomains, forwarding the original `Host` so
  hostname routing works. A 502 on the root domain almost always means an old
  nginx server block still points `/` at a dead upstream — regenerate with
  `FORCE_NGINX=1` (the script leaves existing configs untouched otherwise so
  certbot's SSL edits survive; certbot re-installs the cert into the rewritten
  HTTP block).
- Runtime config persists in `/etc/pointify/api.env` (`SESSION_SECRET`, `PORT`,
  `NODE_ENV`, `ADMIN_DIST`, `PARTNER_DIST`). Port is reused across re-runs unless
  the operator pins `API_PORT`. The script `pm2 delete`s the old process before
  resolving the port so a redeploy keeps the same port instead of incrementing.
- Node 20+ is required (Vite 7 needs 20.19+). `NODE_BIN=/opt/node20/bin/node`
  selects a non-default node for both build and the PM2 `--interpreter`.
