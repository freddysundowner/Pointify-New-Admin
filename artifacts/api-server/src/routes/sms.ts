import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom } from "../lib/upstream";
import { normalizeKenyanMsisdn } from "../lib/phone";
import { checkSendRateLimit } from "../lib/sendRateLimit";

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

interface SmsProviderConfig {
  apiKey: string;
  endpoint: string;
  shortCode: string;
}

/**
 * The SMS provider credentials live in the platform's global settings upstream
 * (`SMS_CONFIG`: SMS_API_KEY / SMS_END_POINT / SMS_SHORT_CODE) — the same
 * config the upstream itself uses to send SMS.
 */
async function smsProviderConfig(
  authHeader: string | undefined,
): Promise<SmsProviderConfig | null> {
  try {
    const result = await upstreamFetch({ method: "GET", path: "/settings/", authHeader });
    if (result.status >= 400) return null;
    const settings = (result.data ?? {}) as Record<string, unknown>;
    const raw = settings["SMS_CONFIG"];
    if (!raw || typeof raw !== "object") return null;
    const cfg = raw as Record<string, unknown>;
    const apiKey = typeof cfg["SMS_API_KEY"] === "string" ? cfg["SMS_API_KEY"].trim() : "";
    const endpoint = typeof cfg["SMS_END_POINT"] === "string" ? cfg["SMS_END_POINT"].trim() : "";
    const shortCode =
      typeof cfg["SMS_SHORT_CODE"] === "string" ? cfg["SMS_SHORT_CODE"].trim() : "";
    if (!apiKey || !endpoint || !shortCode) return null;
    return { apiKey, endpoint, shortCode };
  } catch {
    return null;
  }
}

router.post("/sms/test", async (req, res) => {
  const user = adminIdFromAuth(req.headers.authorization);
  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const rl = checkSendRateLimit(`sms-test:${user}:${req.ip}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    res.status(429).json({
      message: `Too many test SMS. Try again in ${rl.retryAfterSec}s.`,
    });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawPhone = typeof body["phone"] === "string" ? body["phone"].trim() : "";
  const message = typeof body["message"] === "string" ? body["message"].trim() : "";

  const phone = rawPhone ? normalizeKenyanMsisdn(rawPhone) : null;
  if (!phone) {
    res.status(400).json({ message: "A valid Kenyan phone number is required (e.g. 07XXXXXXXX)" });
    return;
  }
  if (!message) {
    res.status(400).json({ message: "Message is required" });
    return;
  }

  const cfg = await smsProviderConfig(authHeaderFrom(req));
  if (!cfg) {
    res.status(503).json({
      message: "SMS sending is not configured. Check the SMS settings in the Settings page.",
    });
    return;
  }

  // Test sends are deliberate, single-recipient, and typed in by the operator.
  try {
    const resp = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_key: cfg.apiKey,
        sender_id: cfg.shortCode,
        phone,
        message,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await resp.text().catch(() => "");
    // The provider (blessedtexts-style API) reports per-message status codes in
    // the body ("1000" = success) and may return HTTP 200 even on failure.
    const ok = resp.ok && (/"?status_?code"?\s*:\s*"?1000"?/i.test(text) || /success/i.test(text));
    req.log.info({ phone, ok, status: resp.status, user }, "Test SMS send attempted");
    if (ok) {
      res.status(200).json({ success: true, message: `Test SMS sent to ${phone}` });
    } else {
      res.status(502).json({
        success: false,
        message: `The SMS provider rejected the send: ${text.slice(0, 300) || `HTTP ${resp.status}`}`,
      });
    }
  } catch (err) {
    req.log.error({ err, phone }, "Test SMS send failed");
    res.status(502).json({ success: false, message: "Could not reach the SMS provider" });
  }
});

router.get("/communications", async (req, res) => {
  await proxyList(req, res, { path: "/communication/", query: req.query as Record<string, unknown> });
});

export default router;
