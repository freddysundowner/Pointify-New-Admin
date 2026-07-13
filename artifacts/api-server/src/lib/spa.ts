import fs from "node:fs";
import path from "node:path";
import express, { type Express, type Router } from "express";
import { logger } from "./logger";

// Resolve a built front-end directory. Prefer an explicit env override (absolute
// or relative to CWD); otherwise fall back to the sibling artifact's build output
// relative to this bundle. At runtime __dirname is artifacts/api-server/dist, so
// "../../<artifact>/dist/public" points at the built SPA.
function resolveDist(envVar: string, fallbackRelative: string): string {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.trim()) {
    return path.resolve(fromEnv.trim());
  }
  return path.resolve(__dirname, fallbackRelative);
}

// A router that serves a built SPA: static assets first, then an index.html
// fallback for client-side routes (deep links).
// Vite emits hashed filenames under /assets (e.g. index-B3xk9d2P.js), which are
// safe to cache forever — a new build produces new names. Everything else
// (index.html above all) must revalidate on every load so a fresh deploy is
// picked up immediately instead of a stale shell pointing at deleted bundles.
function spaRouter(distDir: string): Router {
  const router = express.Router();
  router.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        const isHashedAsset = filePath.includes(
          `${path.sep}assets${path.sep}`,
        );
        res.setHeader(
          "Cache-Control",
          isHashedAsset
            ? "public, max-age=31536000, immutable"
            : "no-cache, must-revalidate",
        );
      },
    }),
  );
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(
      path.join(distDir, "index.html"),
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
      (err) => {
        if (err) {
          next(err);
        }
      },
    );
  });
  return router;
}

// A self-destructing ("kill-switch") service worker. The previous app that lived
// on these domains registered a service worker which keeps intercepting requests
// and serving its stale cached shell from already-visited browsers (the classic
// "old site shows up unless you open incognito"). Our app ships no service worker
// of its own, so by serving THIS at the old worker's URLs we let the browser's
// routine update check replace the stale worker, wipe its caches, unregister it,
// and reload every open tab onto the current app. Safe even where no old worker
// exists — a fresh browser simply never requests these paths.
const KILL_SWITCH_SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (e) {}
      }
    } catch (e) {}
  })());
});
`;

// Worker script paths used by the common build tools the old app might have used
// (vite-plugin-pwa -> /sw.js, CRA/workbox -> /service-worker.js, etc). Browsers
// fetch the registered worker's script directly from the network during their
// update check, so overriding these URLs is enough to retire the stale worker.
const SW_KILL_PATHS = new Set([
  "/sw.js",
  "/service-worker.js",
  "/serviceworker.js",
  "/workbox-sw.js",
]);

function mountServiceWorkerKillSwitch(app: Express): void {
  app.use((req, res, next) => {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      SW_KILL_PATHS.has(req.path.toLowerCase())
    ) {
      res.set("Content-Type", "text/javascript; charset=utf-8");
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Service-Worker-Allowed", "/");
      res.send(KILL_SWITCH_SW);
      return;
    }
    next();
  });
}

// Serve the admin panel and partner portal SPAs from this same process, choosing
// which build to serve by request hostname (admin.* vs partner.*). API requests
// (/api) are left untouched. If a build is missing (e.g. local dev where Vite
// serves the front-ends), that portal is simply skipped.
export function mountSpa(app: Express): void {
  // Always retire any stale service worker first, before host/SPA routing (which
  // would otherwise answer these paths with index.html and break the update).
  mountServiceWorkerKillSwitch(app);

  const adminDist = resolveDist("ADMIN_DIST", "../../admin-panel/dist/public");
  const partnerDist = resolveDist(
    "PARTNER_DIST",
    "../../partner-portal/dist/public",
  );

  const adminReady = fs.existsSync(path.join(adminDist, "index.html"));
  const partnerReady = fs.existsSync(path.join(partnerDist, "index.html"));

  if (!adminReady && !partnerReady) {
    logger.warn(
      { adminDist, partnerDist },
      "No built front-ends found; serving API only. Build admin-panel and partner-portal to serve them from this process.",
    );
    return;
  }

  const adminApp = adminReady ? spaRouter(adminDist) : null;
  const partnerApp = partnerReady ? spaRouter(partnerDist) : null;

  logger.info(
    {
      adminDist: adminReady ? adminDist : null,
      partnerDist: partnerReady ? partnerDist : null,
    },
    "Serving front-ends from API process (host-based)",
  );

  app.use((req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }

    // Strict host mapping: a partner host is served the partner build only, and
    // any other host (admin.* or unknown) is served the admin build only. We
    // never cross-serve — if the matched host's build is missing, fall through.
    const host = (req.hostname || "").toLowerCase();
    const wantsPartner = host === "partner" || host.startsWith("partner.");
    const selected = wantsPartner ? partnerApp : adminApp;

    if (!selected) {
      next();
      return;
    }
    selected(req, res, next);
  });
}
