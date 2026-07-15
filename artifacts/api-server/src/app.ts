import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { mountSpa } from "./lib/spa";
import { renderWhatsNewPage } from "./routes/whats-new";

const app: Express = express();

// API responses must never be cached — not by the browser, not by any reverse
// proxy (nginx/CDN) sitting in front of a self-hosted deployment. A cached API
// error (e.g. a 404 from an older build) would otherwise keep "coming back"
// even after the code is updated. Disabling ETags also stops conditional 304
// revalidation on API routes; static assets keep their own ETags.
app.set("etag", false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("X-Build-Time", process.env.BUILD_TIME ?? "dev");
  next();
});
app.use("/api", router);

// Public "What's New" page — the destination of the "See What's New" button in
// marketing emails. Registered before the SPA fallback so it is reachable on
// every host without authentication.
app.get("/whats-new", (_req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.status(200).type("html").send(renderWhatsNewPage());
});

// Serve the admin + partner SPAs from this same process (host-based). Registered
// after /api so API requests are never shadowed by the static/SPA fallback.
mountSpa(app);

export default app;
