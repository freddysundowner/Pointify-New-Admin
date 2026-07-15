import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";
import { logger } from "../lib/logger";
import { normalizeKenyanMsisdn } from "../lib/phone";
import { checkSendRateLimit } from "../lib/sendRateLimit";
import { personalize } from "./email";

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

/**
 * Same safety gate as bulk email: real proxy-side SMS sends only happen in
 * production or when SMS_SEND_ENABLED=true; everywhere else the run is a dry
 * run (recipients resolved and counted, nothing sent), because dev talks to
 * the live POS API and would otherwise SMS real partners.
 */
function smsSendingEnabled(): boolean {
  if (process.env["SMS_SEND_ENABLED"]?.trim().toLowerCase() === "true") return true;
  return process.env["NODE_ENV"] === "production";
}

/**
 * Resolve all partner phone numbers by querying the affiliate list page by
 * page, incrementing the page number until every partner has been fetched.
 */
interface PartnerSmsRecipient {
  phone: string;
  name?: string;
  code?: string;
}

async function resolvePartnerPhones(
  authHeader: string | undefined,
): Promise<PartnerSmsRecipient[]> {
  const recipients = new Map<string, PartnerSmsRecipient>();
  const PAGE_LIMIT = 200;
  const MAX_PAGES = 200;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await upstreamFetch({
      method: "GET",
      path: "/affiliates/",
      query: { page, limit: PAGE_LIMIT },
      authHeader,
    });
    if (result.status >= 400) {
      throw new Error(`Upstream partner list failed with status ${result.status}`);
    }
    const norm = normalizeList(result.data);
    for (const row of norm.data) {
      if (!row || typeof row !== "object") continue;
      // Affiliates store their phone as `phonenumber` (fall back to `phone`
      // defensively in case the upstream shape ever changes).
      const rec = row as Record<string, unknown>;
      const raw = typeof rec["phonenumber"] === "string" ? rec["phonenumber"] : rec["phone"];
      if (typeof raw !== "string") continue;
      const normalized = normalizeKenyanMsisdn(raw.trim());
      if (!normalized || recipients.has(normalized)) continue;
      const name = typeof rec["name"] === "string" && rec["name"].trim() ? rec["name"].trim() : undefined;
      const code = typeof rec["code"] === "string" && rec["code"].trim() ? rec["code"].trim() : undefined;
      recipients.set(normalized, { phone: normalized, name, code });
    }
    if (norm.data.length < PAGE_LIMIT) break;
    if (norm.totalPages && page >= norm.totalPages) break;
  }
  return [...recipients.values()];
}

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
  // Upstream now handles every user audience natively (including "all"), dedupes
  // to one message per user, and returns 202 immediately while sending in the
  // background — so we simply forward and pass its status/body straight through.
  const { user: _ignored, ...rest } = (req.body ?? {}) as Record<string, unknown>;

  // The "partners" audience is NOT known upstream — the proxy resolves the
  // affiliate list itself and sends via the platform's SMS provider directly.
  if (rest["userType"] === "partners") {
    const rl = checkSendRateLimit(`sms-bulk:${user}:${req.ip}`, 3, 10 * 60_000);
    if (!rl.allowed) {
      res.status(429).json({
        message: `Too many bulk SMS requests. Try again in ${rl.retryAfterSec}s.`,
      });
      return;
    }

    const message = typeof rest["message"] === "string" ? rest["message"].trim() : "";
    if (!message) {
      res.status(400).json({ message: "Message is required" });
      return;
    }

    let phones: PartnerSmsRecipient[];
    try {
      phones = await resolvePartnerPhones(authHeaderFrom(req));
    } catch (err) {
      req.log.error({ err }, "Bulk partner SMS: partner resolution failed");
      res.status(502).json({ message: "Failed to load the partner list from the POS API" });
      return;
    }

    if (phones.length === 0) {
      res.status(200).json({
        message: "No partners with a valid phone number were found",
        userType: "partners",
        status: "empty",
        total: 0,
      });
      return;
    }

    if (!smsSendingEnabled()) {
      req.log.info(
        { total: phones.length, user },
        "Bulk partner SMS DRY RUN: sending disabled outside production; nothing sent",
      );
      res.status(202).json({
        message:
          "Dry run: partners resolved, but no SMS were sent (sending is only enabled in production)",
        userType: "partners",
        status: "dry_run",
        total: phones.length,
      });
      return;
    }

    const cfg = await smsProviderConfig(authHeaderFrom(req));
    if (!cfg) {
      res.status(503).json({
        message: "SMS sending is not configured. Check the SMS settings in the Settings page.",
      });
      return;
    }

    req.log.info(
      { total: phones.length, user },
      "Bulk partner SMS accepted; sending in background",
    );
    res.status(202).json({
      message: "Bulk SMS to partners is being sent in the background",
      userType: "partners",
      status: "processing",
      total: phones.length,
    });

    void (async () => {
      let sent = 0;
      let failed = 0;
      for (const r of phones) {
        const result = await sendOneSms(cfg, r.phone, personalize(message, r));
        if (result.ok) sent++;
        else {
          failed++;
          logger.warn({ phone: r.phone, detail: result.detail }, "Bulk partner SMS: send failed");
        }
      }
      logger.info({ total: phones.length, sent, failed }, "Bulk partner SMS run finished");
    })().catch((err) => {
      logger.error({ err }, "Bulk partner SMS background run crashed");
    });
    return;
  }

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

/**
 * Send one SMS via the platform's provider (blessedtexts-style API). The
 * provider reports per-message status codes in the body ("1000" = success)
 * and may return HTTP 200 even on failure, so branch on the body.
 */
async function sendOneSms(
  cfg: SmsProviderConfig,
  phone: string,
  message: string,
): Promise<{ ok: boolean; detail?: string }> {
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
    const ok = resp.ok && (/"?status_?code"?\s*:\s*"?1000"?/i.test(text) || /success/i.test(text));
    return ok
      ? { ok: true }
      : { ok: false, detail: text.slice(0, 300) || `HTTP ${resp.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
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
  // Placeholders are filled with sample values so the operator can preview them.
  const result = await sendOneSms(
    cfg,
    phone,
    personalize(message, { name: "Jane Wanjiku", code: "1234567" }),
  );
  req.log.info({ phone, ok: result.ok, user }, "Test SMS send attempted");
  if (result.ok) {
    res.status(200).json({ success: true, message: `Test SMS sent to ${phone}` });
  } else {
    res.status(502).json({
      success: false,
      message: `The SMS provider rejected the send: ${result.detail}`,
    });
  }
});

router.get("/communications", async (req, res) => {
  await proxyList(req, res, { path: "/communication/", query: req.query as Record<string, unknown> });
});

export default router;
