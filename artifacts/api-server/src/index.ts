import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// The partner portal mints and verifies its own signed session tokens with this
// secret (see routes/portal.ts). Without it the portal fails closed (logins 502,
// all protected routes 401), so fail fast at startup with a clear message rather
// than serving a silently-broken portal.
if (!process.env["SESSION_SECRET"]) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
