import { Router, type IRouter } from "express";
import { upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const AUDIENCES = [
  "all",
  "trial_active",
  "trial_expired",
  "production_active",
  "production_expired",
] as const;
type Audience = (typeof AUDIENCES)[number];

function isAudience(v: unknown): v is Audience {
  return typeof v === "string" && (AUDIENCES as readonly string[]).includes(v);
}

/** Same auth gate as the bulk SMS route: require a bearer token whose JWT payload decodes to an admin id. */
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

interface BrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/**
 * The Brevo credentials live in the platform's global settings upstream
 * (`EMAIL_CONFIG`: BREVO_API_KEY / BREVO_SENDER_EMAIL / BREVO_SENDER_NAME),
 * editable from the admin Settings page. Env vars act as an override/fallback.
 */
async function brevoConfig(authHeader: string | undefined): Promise<BrevoConfig | null> {
  const envKey = process.env["BREVO_API_KEY"]?.trim();
  const envFrom = process.env["EMAIL_FROM"]?.trim();
  if (envKey && envFrom) {
    return {
      apiKey: envKey,
      fromEmail: envFrom,
      fromName: process.env["EMAIL_FROM_NAME"]?.trim() || "Pointify POS",
    };
  }
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/settings/",
      authHeader,
    });
    if (result.status >= 400) return null;
    const settings = (result.data ?? {}) as Record<string, unknown>;
    const emailCfg = settings["EMAIL_CONFIG"];
    if (!emailCfg || typeof emailCfg !== "object") return null;
    const cfg = emailCfg as Record<string, unknown>;
    const apiKey = typeof cfg["BREVO_API_KEY"] === "string" ? cfg["BREVO_API_KEY"].trim() : "";
    const fromEmail =
      typeof cfg["BREVO_SENDER_EMAIL"] === "string" ? cfg["BREVO_SENDER_EMAIL"].trim() : "";
    if (!apiKey || !fromEmail) return null;
    const fromName =
      typeof cfg["BREVO_SENDER_NAME"] === "string" && cfg["BREVO_SENDER_NAME"].trim()
        ? cfg["BREVO_SENDER_NAME"].trim()
        : "Pointify POS";
    return { apiKey, fromEmail, fromName };
  } catch (err) {
    logger.warn({ err }, "Bulk email: failed to load EMAIL_CONFIG from settings");
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function collectEmails(rows: unknown[], into: Set<string>): void {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const email = (row as Record<string, unknown>)["email"];
    if (typeof email !== "string") continue;
    const trimmed = email.trim().toLowerCase();
    if (EMAIL_RE.test(trimmed)) into.add(trimmed);
  }
}

/**
 * Resolve an audience to a deduplicated list of user email addresses.
 *
 * - "all" pages through the full admin list (upstream /admin/).
 * - Segments page through upstream /admin/users/subscriptions with
 *   subscriptionType + subscriptionStatus, which classifies users the same way
 *   the platform's own subscription statistics do.
 */
async function resolveAudienceEmails(
  audience: Audience,
  authHeader: string | undefined,
): Promise<string[]> {
  const emails = new Set<string>();
  const PAGE_LIMIT = 500;
  const MAX_PAGES = 200; // hard stop: 100k users

  if (audience === "all") {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await upstreamFetch({
        method: "GET",
        path: "/admin/",
        query: { page, limit: PAGE_LIMIT },
        authHeader,
      });
      if (result.status >= 400) {
        throw new Error(`Upstream admin list failed with status ${result.status}`);
      }
      const norm = normalizeList(result.data);
      collectEmails(norm.data, emails);
      if (norm.data.length < PAGE_LIMIT) break;
      if (norm.totalPages && page >= norm.totalPages) break;
    }
    return [...emails];
  }

  const [type, status] = audience.split("_") as [string, string];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await upstreamFetch({
      method: "GET",
      path: "/admin/users/subscriptions",
      query: {
        subscriptionType: type,
        subscriptionStatus: status,
        page,
        limit: PAGE_LIMIT,
      },
      authHeader,
    });
    if (result.status >= 400) {
      throw new Error(
        `Upstream subscription audience lookup failed with status ${result.status}`,
      );
    }
    const body = (result.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(body["admins"])
      ? (body["admins"] as unknown[])
      : normalizeList(result.data).data;
    collectEmails(rows, emails);
    const totalPages =
      typeof body["totalPages"] === "number" ? body["totalPages"] : undefined;
    if (rows.length < PAGE_LIMIT) break;
    if (totalPages && page >= totalPages) break;
  }
  return [...emails];
}

/** Very small text→HTML conversion: escape, then preserve line breaks. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; white-space: pre-wrap;">${escaped}</div>`;
}

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Safety gate: real sends only happen in production, or when explicitly
 * enabled with EMAIL_SEND_ENABLED=true. Everywhere else the run is a dry run
 * (recipients are resolved and logged, but nothing is sent), because the dev
 * environment talks to the live POS API and would otherwise email real users.
 */
function sendingEnabled(): boolean {
  if (process.env["EMAIL_SEND_ENABLED"]?.trim().toLowerCase() === "true") return true;
  return process.env["NODE_ENV"] === "production";
}

/**
 * Send emails one at a time via the Brevo transactional API in the background.
 * Sequential sending keeps us well under Brevo's rate limits; failures are
 * logged and skipped so one bad address never aborts the whole run.
 */
async function sendInBackground(
  cfg: BrevoConfig,
  recipients: string[],
  subject: string,
  message: string,
  audience: Audience,
): Promise<void> {
  const html = textToHtml(message);
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      const resp = await fetch(BREVO_SEND_URL, {
        method: "POST",
        headers: {
          "api-key": cfg.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: cfg.fromEmail, name: cfg.fromName },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: message,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) {
        sent++;
      } else {
        failed++;
        const body = await resp.text().catch(() => "");
        logger.warn(
          { to, status: resp.status, body: body.slice(0, 300) },
          "Bulk email: Brevo rejected the send for recipient",
        );
      }
    } catch (err) {
      failed++;
      logger.warn({ err, to }, "Bulk email: send failed for recipient");
    }
  }
  logger.info(
    { audience, total: recipients.length, sent, failed },
    "Bulk email run finished",
  );
}

router.get("/email/status", async (req, res) => {
  const cfg = await brevoConfig(authHeaderFrom(req));
  res.status(200).json({ configured: cfg !== null });
});

router.post("/email/bulk", async (req, res) => {
  const sender = adminIdFromAuth(req.headers.authorization);
  if (!sender) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const cfg = await brevoConfig(authHeaderFrom(req));
  if (!cfg) {
    res.status(503).json({
      message:
        "Email sending is not configured. Add the Brevo API key and sender email in Settings.",
    });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const userType = body["userType"];
  const subject = typeof body["subject"] === "string" ? body["subject"].trim() : "";
  const message = typeof body["message"] === "string" ? body["message"].trim() : "";

  if (!isAudience(userType)) {
    res.status(400).json({ message: "Invalid userType" });
    return;
  }
  if (!subject) {
    res.status(400).json({ message: "Subject is required" });
    return;
  }
  if (!message) {
    res.status(400).json({ message: "Message is required" });
    return;
  }

  let recipients: string[];
  try {
    recipients = await resolveAudienceEmails(userType, authHeaderFrom(req));
  } catch (err) {
    req.log.error({ err, userType }, "Bulk email: audience resolution failed");
    res.status(502).json({ message: "Failed to resolve the audience from the POS API" });
    return;
  }

  if (recipients.length === 0) {
    res.status(200).json({
      message: "No users with a valid email address matched this audience",
      userType,
      status: "empty",
      total: 0,
    });
    return;
  }

  if (!sendingEnabled()) {
    req.log.info(
      { userType, total: recipients.length, sender },
      "Bulk email DRY RUN: sending disabled outside production; nothing sent",
    );
    res.status(202).json({
      message:
        "Dry run: recipients resolved, but no emails were sent (sending is only enabled in production)",
      userType,
      status: "dry_run",
      total: recipients.length,
    });
    return;
  }

  req.log.info(
    { userType, total: recipients.length, sender },
    "Bulk email accepted; sending in background",
  );
  res.status(202).json({
    message: "Bulk email is being sent in the background",
    userType,
    status: "processing",
    total: recipients.length,
  });

  void sendInBackground(cfg, recipients, subject, message, userType).catch((err) => {
    logger.error({ err, userType }, "Bulk email background run crashed");
  });
});

export default router;
