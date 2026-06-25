import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

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
  // Strip any client-supplied `user` and inject the server-derived sender.
  // Upstream now handles every audience natively (including "all"), dedupes to
  // one message per user, and returns 202 immediately while sending in the
  // background — so we simply forward and pass its status/body straight through.
  const { user: _ignored, ...rest } = (req.body ?? {}) as Record<string, unknown>;

  await proxy(req, res, {
    method: "POST",
    path: "/communication/bulk/sms",
    body: { ...rest, user },
  });
});

router.get("/communications", async (req, res) => {
  await proxyList(req, res, { path: "/communication/", query: req.query as Record<string, unknown> });
});

export default router;
