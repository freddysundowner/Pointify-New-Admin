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
function spaRouter(distDir: string): Router {
  const router = express.Router();
  router.use(express.static(distDir, { index: false, maxAge: "1h" }));
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) {
        next(err);
      }
    });
  });
  return router;
}

// Serve the admin panel and partner portal SPAs from this same process, choosing
// which build to serve by request hostname (admin.* vs partner.*). API requests
// (/api) are left untouched. If a build is missing (e.g. local dev where Vite
// serves the front-ends), that portal is simply skipped.
export function mountSpa(app: Express): void {
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
