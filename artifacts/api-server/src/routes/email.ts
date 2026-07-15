import { Router, type IRouter } from "express";
import { upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";
import { logger } from "../lib/logger";
import { checkSendRateLimit } from "../lib/sendRateLimit";

const router: IRouter = Router();

const AUDIENCES = [
  "all",
  "trial_active",
  "trial_expired",
  "production_active",
  "production_expired",
  "partners",
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

/** Base URL for a partner's shareable referral link ({link} placeholder). */
const REFERRAL_LINK_BASE = "https://pointifypos.com/download";

export interface Recipient {
  email: string;
  /** Display name used for the {name} placeholder. */
  name?: string;
  /** Partner referral code used for the {code} and {link} placeholders. */
  code?: string;
}

function stringField(row: Record<string, unknown>, key: string): string | undefined {
  const v = row[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function collectRecipients(rows: unknown[], into: Map<string, Recipient>): void {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const email = stringField(rec, "email")?.toLowerCase();
    if (!email || !EMAIL_RE.test(email)) continue;
    if (into.has(email)) continue;
    into.set(email, {
      email,
      // Partners have `name`; admins/users have `username` (fall back to `name`).
      name: stringField(rec, "name") ?? stringField(rec, "username"),
      code: stringField(rec, "code"),
    });
  }
}

/**
 * Replace personalization placeholders in operator-authored content.
 * Supported: {name} (falls back to a friendly generic), {code} (partner
 * referral code), {link} (partner's shareable download link with their code).
 */
export function personalize(
  text: string,
  r: { name?: string; code?: string },
  opts: { html?: boolean } = {},
): string {
  const esc = (v: string) =>
    opts.html
      ? v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      : v;
  const link = r.code
    ? `${REFERRAL_LINK_BASE}?ref=${encodeURIComponent(r.code)}`
    : REFERRAL_LINK_BASE;
  return text
    .replace(/\{\s*name\s*\}/gi, esc(r.name ?? "there"))
    .replace(/\{\s*code\s*\}/gi, esc(r.code ?? ""))
    .replace(/\{\s*link\s*\}/gi, link);
}

/**
 * Resolve an audience to a deduplicated list of user email addresses.
 *
 * - "all" pages through the full admin list (upstream /admin/).
 * - "partners" pages through the affiliate list (upstream /affiliates/).
 * - Segments page through upstream /admin/users/subscriptions with
 *   subscriptionType + subscriptionStatus, which classifies users the same way
 *   the platform's own subscription statistics do.
 */
async function resolveAudienceRecipients(
  audience: Audience,
  authHeader: string | undefined,
): Promise<Recipient[]> {
  const recipients = new Map<string, Recipient>();
  const PAGE_LIMIT = 500;
  const MAX_PAGES = 200; // hard stop: 100k users

  if (audience === "partners") {
    // Query page by page until every partner has been collected.
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
      collectRecipients(norm.data, recipients);
      if (norm.data.length < PAGE_LIMIT) break;
      if (norm.totalPages && page >= norm.totalPages) break;
    }
    return [...recipients.values()];
  }

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
      collectRecipients(norm.data, recipients);
      if (norm.data.length < PAGE_LIMIT) break;
      if (norm.totalPages && page >= norm.totalPages) break;
    }
    return [...recipients.values()];
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
    collectRecipients(rows, recipients);
    const totalPages =
      typeof body["totalPages"] === "number" ? body["totalPages"] : undefined;
    if (rows.length < PAGE_LIMIT) break;
    if (totalPages && page >= totalPages) break;
  }
  return [...recipients.values()];
}

/**
 * Minimal server-side hardening for operator-authored rich-text HTML: strip
 * script/style blocks, inline event handlers, and javascript: URLs. The author
 * is a trusted admin, but the mail must never carry active content.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*(?:javascript|vbscript|data):[^"'\s>]*\2/gi, "");
}

/**
 * Branded email shell: centered 600px table layout with a Pointify header and
 * a colored footer. Table-based with inline styles only, for maximum email
 * client compatibility (Gmail, Outlook, Yahoo strip <style> blocks).
 */
function emailShell(inner: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; border-collapse:collapse;">
          <tr>
            <td style="background-color:#2563eb; border-radius:12px 12px 0 0; padding:22px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                    Pointify&nbsp;<span style="color:#bfdbfe;">POS</span>
                  </td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#bfdbfe;">
                    Smart selling, simple business
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff; padding:32px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.7; color:#1f2937;">
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="background-color:#1e3a8a; border-radius:0 0 12px 12px; padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#ffffff; padding-bottom:6px;">
                    Pointify POS
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#bfdbfe; padding-bottom:12px;">
                    The point of sale that fits in your pocket &mdash; sales, stock and reports for your shop, anywhere.
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif; font-size:12px; padding-bottom:14px;">
                    <a href="https://pointifypos.com" style="color:#93c5fd; text-decoration:none; font-weight:bold;">pointifypos.com</a>
                    <span style="color:#3b5bb5;">&nbsp;&bull;&nbsp;</span>
                    <a href="https://pointifypos.com/download" style="color:#93c5fd; text-decoration:none; font-weight:bold;">Get the app</a>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #3b5bb5; padding-top:12px; font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#93a8dd;">
                    &copy; ${year} Pointify POS. All rights reserved.<br/>
                    You are receiving this email because you have a Pointify POS account.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Wrap rich-text body in the branded shell. */
function wrapHtmlBody(inner: string): string {
  return emailShell(inner);
}

/** Very small text→HTML conversion: escape, preserve line breaks, then wrap in the shell. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return emailShell(`<div style="white-space: pre-wrap;">${escaped}</div>`);
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

/** Send a single email via the Brevo transactional API. */
async function sendOneEmail(
  cfg: BrevoConfig,
  to: string,
  subject: string,
  message: string,
  html?: string,
): Promise<{ ok: boolean; detail?: string }> {
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
        htmlContent: html ? wrapHtmlBody(sanitizeHtml(html)) : textToHtml(message),
        textContent: message,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (resp.ok) return { ok: true };
    const body = await resp.text().catch(() => "");
    return { ok: false, detail: `Brevo responded ${resp.status}: ${body.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send emails one at a time via the Brevo transactional API in the background.
 * Sequential sending keeps us well under Brevo's rate limits; failures are
 * logged and skipped so one bad address never aborts the whole run.
 */
async function sendInBackground(
  cfg: BrevoConfig,
  recipients: Recipient[],
  subject: string,
  message: string,
  audience: Audience,
  html?: string,
): Promise<void> {
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendOneEmail(
      cfg,
      r.email,
      personalize(subject, r),
      personalize(message, r),
      html ? personalize(html, r, { html: true }) : undefined,
    );
    if (result.ok) {
      sent++;
    } else {
      failed++;
      logger.warn(
        { to: r.email, detail: result.detail },
        "Bulk email: send failed for recipient",
      );
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

router.post("/email/test", async (req, res) => {
  const sender = adminIdFromAuth(req.headers.authorization);
  if (!sender) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const rl = checkSendRateLimit(`email-test:${sender}:${req.ip}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    res.status(429).json({
      message: `Too many test emails. Try again in ${rl.retryAfterSec}s.`,
    });
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
  const to = typeof body["to"] === "string" ? body["to"].trim().toLowerCase() : "";
  const subject = typeof body["subject"] === "string" ? body["subject"].trim() : "";
  const message = typeof body["message"] === "string" ? body["message"].trim() : "";
  const html = typeof body["html"] === "string" && body["html"].trim() ? body["html"] : undefined;

  if (!EMAIL_RE.test(to)) {
    res.status(400).json({ message: "A valid recipient email address is required" });
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

  // Test sends are deliberate, single-recipient, and typed in by the operator,
  // so they are allowed in every environment (no production-only gate).
  // Placeholders are filled with sample values so the operator can preview them.
  const sample = { name: "Jane Wanjiku", code: "1234567" };
  const result = await sendOneEmail(
    cfg,
    to,
    personalize(subject, sample),
    personalize(message, sample),
    html ? personalize(html, sample, { html: true }) : undefined,
  );
  req.log.info({ to, ok: result.ok, sender }, "Test email send attempted");
  if (result.ok) {
    res.status(200).json({ success: true, message: `Test email sent to ${to}` });
  } else {
    res.status(502).json({ success: false, message: result.detail ?? "The email provider rejected the send" });
  }
});

router.post("/email/bulk", async (req, res) => {
  const sender = adminIdFromAuth(req.headers.authorization);
  if (!sender) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const rl = checkSendRateLimit(`email-bulk:${sender}:${req.ip}`, 3, 10 * 60_000);
  if (!rl.allowed) {
    res.status(429).json({
      message: `Too many bulk email requests. Try again in ${rl.retryAfterSec}s.`,
    });
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
  const html = typeof body["html"] === "string" && body["html"].trim() ? body["html"] : undefined;

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

  let recipients: Recipient[];
  try {
    recipients = await resolveAudienceRecipients(userType, authHeaderFrom(req));
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

  void sendInBackground(cfg, recipients, subject, message, userType, html).catch((err) => {
    logger.error({ err, userType }, "Bulk email background run crashed");
  });
});

export default router;
