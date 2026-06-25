---
name: Stale service worker from a previous app on the same domain
description: Why admin/partner domains can keep showing an OLD app even after deploy, and the self-destructing service worker that fixes it.
---

# Old app's service worker hijacks the domain

A prior app ("Marketing Partners") that lived on `partner.pointifypos.com`
registered a **service worker**. After we redeployed our app to the same domain,
already-visited browsers kept showing the OLD app's cached shell — but it worked
in incognito. That split (normal browser = old, incognito = new) is the tell-tale
signature of a stuck service worker, NOT an nginx/DNS/cache-header problem.

**Why a redeploy alone doesn't fix it:** the installed SW intercepts navigations
and serves its own cached shell. The browser only retires it when it re-fetches
the *registered SW script URL* during its update check and gets a valid, byte-
different JavaScript response. If that URL returns HTML (our SPA fallback) the
update FAILS and the old SW lives on forever.

**The fix (in `lib/spa.ts`, mounted before host/SPA routing):** serve a
self-destructing "kill-switch" service worker at the worker URLs the old build
might have used (`/sw.js`, `/service-worker.js`, `/serviceworker.js`,
`/workbox-sw.js`). It must be served as real JS (`Content-Type: text/javascript`)
with `Cache-Control: no-cache`. On `activate` it deletes all caches, calls
`registration.unregister()`, then `clients.navigate(client.url)` to reload open
tabs onto the current app. It is harmless on fresh browsers (they never request
those paths).

**How to apply / gotchas:**
- The kill-switch MUST be registered before the SPA `index.html` fallback, or the
  fallback answers `/sw.js` with HTML and the update never happens.
- It only takes effect once the api-server bundle is redeployed (git pull +
  rebuild + pm2 restart) since that's what serves these URLs in production.
- For an operator's own already-broken browser, the immediate manual fix is
  DevTools → Application → Service Workers → Unregister (or Clear site data);
  the kill-switch is the durable fix for everyone else.
- Our app ships NO service worker of its own, so these paths are free to repurpose
  as the kill-switch.
