import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom } from "../lib/upstream";

const router: IRouter = Router();

const ALL_USER_TYPES = [
  "trial_active",
  "trial_expired",
  "production_active",
  "production_expired",
] as const;

/**
 * Read the authenticated admin's id from the bearer token's JWT payload
 * (upstream login signs `{ email, _id }`). Used to attribute server-side
 * actions instead of trusting a client-supplied sender id.
 */
function adminIdFromAuth(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) return undefined;
  const segments = match[1].split(".");
  if (segments.length < 2) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    ) as { _id?: unknown; id?: unknown };
    const id = payload._id ?? payload.id;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

router.get("/sms/logs", async (req, res) => {
  await proxyList(req, res, { path: "/sms/sms-logs", query: req.query as Record<string, unknown> });
});

router.post("/sms/topup", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/sms/topup", body: req.body });
});

router.post("/sms/bulk", async (req, res) => {
  // Require a bearer token that decodes to an admin id. This is the strongest
  // gate possible from a stateless proxy that does not hold the upstream JWT
  // secret: it rejects missing/malformed tokens and guarantees the bulk send
  // is attributed to a derived sender (client-supplied `user` is ignored).
  const user = adminIdFromAuth(req.headers.authorization);
  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const { user: _ignored, userType, ...rest } = (req.body ?? {}) as Record<string, unknown>;

  // Upstream has no "all" audience. The four segments are mutually exclusive
  // (each shop has one subscription type + one active/expired state), so we
  // fan out to all four in parallel and aggregate the counts. Parallel (not
  // sequential) keeps total time bounded by the slowest single call, staying
  // under the platform's ~50s proxy cap.
  if (userType === "all") {
    const results = await Promise.allSettled(
      ALL_USER_TYPES.map((t) =>
        upstreamFetch({
          method: "POST",
          path: "/communication/bulk/sms",
          body: { ...rest, userType: t, user },
          authHeader: authHeaderFrom(req),
        }),
      ),
    );
    let total = 0;
    let sent = 0;
    let failed = 0;
    let segmentsFailed = 0;
    for (const r of results) {
      if (
        r.status === "fulfilled" &&
        r.value.status < 400 &&
        r.value.data &&
        typeof r.value.data === "object"
      ) {
        const d = r.value.data as Record<string, unknown>;
        total += Number(d["total"] ?? 0) || 0;
        sent += Number(d["sent"] ?? 0) || 0;
        failed += Number(d["failed"] ?? 0) || 0;
      } else {
        // A whole segment call errored — its recipients aren't reflected in the
        // aggregated counts, so flag it as partial so the UI doesn't imply the
        // numbers are complete.
        segmentsFailed += 1;
      }
    }
    if (segmentsFailed === ALL_USER_TYPES.length) {
      req.log.error({ results }, "Bulk SMS 'all' fan-out failed for every segment");
      res.status(502).json({ message: "Upstream request failed" });
      return;
    }
    res.status(200).json({
      message: "Bulk SMS completed",
      userType: "all",
      total,
      sent,
      failed,
      partialFailure: segmentsFailed > 0,
    });
    return;
  }

  await proxy(req, res, {
    method: "POST",
    path: "/communication/bulk/sms",
    body: { ...rest, userType, user },
  });
});

router.get("/communications", async (req, res) => {
  await proxyList(req, res, { path: "/communication/", query: req.query as Record<string, unknown> });
});

export default router;
