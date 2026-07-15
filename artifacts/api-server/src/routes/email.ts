import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
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

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function smtpConfig(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"]?.trim();
  const portRaw = process.env["SMTP_PORT"]?.trim();
  const user = process.env["SMTP_USER"]?.trim();
  const pass = process.env["SMTP_PASS"]?.trim();
  if (!host || !user || !pass) return null;
  const port = portRaw ? parseInt(portRaw, 10) : 587;
  if (!Number.isFinite(port) || port <= 0) return null;
  const from = process.env["EMAIL_FROM"]?.trim() || user;
  return { host, port, user, pass, from };
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

/**
 * Send emails one at a time in the background. Sequential sending keeps us
 * well under typical SMTP rate limits; failures are logged and skipped so one
 * bad address never aborts the whole run.
 */
async function sendInBackground(
  cfg: SmtpConfig,
  recipients: string[],
  subject: string,
  message: string,
  audience: Audience,
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const html = textToHtml(message);
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      await transport.sendMail({ from: cfg.from, to, subject, text: message, html });
      sent++;
    } catch (err) {
      failed++;
      logger.warn({ err, to }, "Bulk email: send failed for recipient");
    }
  }
  transport.close();
  logger.info(
    { audience, total: recipients.length, sent, failed },
    "Bulk email run finished",
  );
}

router.get("/email/status", (_req, res) => {
  res.status(200).json({ configured: smtpConfig() !== null });
});

router.post("/email/bulk", async (req, res) => {
  const sender = adminIdFromAuth(req.headers.authorization);
  if (!sender) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const cfg = smtpConfig();
  if (!cfg) {
    res.status(503).json({
      message:
        "Email sending is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS on the server.",
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
