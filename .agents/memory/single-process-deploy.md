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
  `FORCE_NGINX=1`.

## nginx/SSL is written by the script, NOT by certbot edits

**Why:** letting `certbot --nginx --redirect` edit the vhost in-place is fragile.
Two failures actually hit prod here:
1. With a legacy `sites-enabled/<domain>` (no `.conf`) still enabled, certbot
   wired the cert into the OLD dead vhost → 502 on HTTPS, or a wildcard/default
   443 block served a *completely different old app* (e.g. "Marketing Partners").
2. certbot left its `if ($host=...) return 301 https://...` **inside the 443
   block**, so every HTTPS request redirected to HTTPS → infinite loop, app never
   served.

**How to apply:**
- `emit_vhost()` writes the full config itself: a port-80 `return 301` redirect
  block PLUS a separate `listen 443 ssl` proxy block (cert paths from
  `/etc/letsencrypt/live/$domain`, ssl options included only if the files exist).
  If no cert yet, it writes an HTTP-only proxy block so the site works and the
  http-01 challenge can pass.
- `ensure_ssl()` uses `certbot certonly --nginx` (fetch only, no nginx edit),
  then calls `emit_vhost` + `nginx -t && reload`. Never `certbot install
  --redirect`.
- `write_nginx()` also disables a legacy per-domain enabled symlink named exactly
  `$domain` (without `.conf`) before linking ours, so duplicates can't shadow us.
- The redirect (`return 301 https`) must ONLY ever live in the port-80 server
  block. If it appears in the 443 block, that's the loop — fix by rewriting the
  vhost as two clean blocks.
- Runtime config persists in `/etc/pointify/api.env` (`SESSION_SECRET`, `PORT`,
  `NODE_ENV`, `ADMIN_DIST`, `PARTNER_DIST`). Port is reused across re-runs unless
  the operator pins `API_PORT`. The script `pm2 delete`s the old process before
  resolving the port so a redeploy keeps the same port instead of incrementing.
- Node 20+ is required (Vite 7 needs 20.19+). `NODE_BIN=/opt/node20/bin/node`
  selects a non-default node for both build and the PM2 `--interpreter`.
