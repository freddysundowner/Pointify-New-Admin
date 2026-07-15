import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { upstreamFetch, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

/**
 * "What's New" is operator-authored platform content (not POS data), so it is
 * stored locally as a JSON file next to the server instead of upstream. On the
 * self-hosted VPS the file lives inside the app directory and survives
 * redeploys because deploys are git pulls into the same directory.
 */
// At runtime __dirname is artifacts/api-server/dist (bundled output), so
// "../data" is artifacts/api-server/data — kept out of git.
const DATA_FILE = process.env["WHATS_NEW_FILE"]?.trim()
  ? path.resolve(process.env["WHATS_NEW_FILE"]!.trim())
  : path.resolve(__dirname, "../data/whats-new.json");

// Stricter than the generated SaveWhatsNewBody: trims, requires non-empty
// titles, and caps sizes so the public page can't be flooded.
const entrySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional(),
  date: z.string().trim().max(40).optional(),
});

const inputSchema = z.object({
  entries: z.array(entrySchema).max(50),
});

export interface WhatsNewEntry {
  title: string;
  body?: string;
  date?: string;
}

export interface WhatsNewContent {
  entries: WhatsNewEntry[];
  updatedAt?: string;
}

export function readWhatsNew(): WhatsNewContent {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const check = inputSchema
      .extend({ updatedAt: z.string().optional() })
      .safeParse(parsed);
    if (check.success) return check.data;
    logger.warn({ file: DATA_FILE }, "whats-new file has invalid shape; serving empty list");
    return { entries: [] };
  } catch {
    return { entries: [] };
  }
}

function writeWhatsNew(content: WhatsNewContent): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(content, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

/** Decode the bearer JWT payload (upstream login signs `{ email, _id }`). */
function claimsFromAuth(
  header: string | undefined,
): { id: string; email: string } | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      _id?: unknown;
      email?: unknown;
    };
    if (typeof payload._id !== "string" || !payload._id) return undefined;
    if (typeof payload.email !== "string" || !payload.email) return undefined;
    return { id: payload._id, email: payload.email };
  } catch {
    return undefined;
  }
}

// The proxy cannot cryptographically verify upstream tokens (it does not hold
// the upstream JWT secret), so beyond decoding the claims we cross-check them
// against the upstream admin directory: the token's `_id` AND `email` must
// belong to the same real admin account. Successful checks are cached briefly.
const verifiedAdmins = new Map<string, number>();
const VERIFY_TTL_MS = 5 * 60 * 1000;

async function isRealAdmin(claims: { id: string; email: string }, authHeader: string | undefined): Promise<boolean> {
  const key = `${claims.id}:${claims.email.toLowerCase()}`;
  const cachedAt = verifiedAdmins.get(key);
  if (cachedAt && Date.now() - cachedAt < VERIFY_TTL_MS) return true;
  try {
    // Upstream `name` matches username/email/phone.
    const result = await upstreamFetch({
      method: "GET",
      path: "/admin/",
      query: { name: claims.email, page: 1, limit: 50 },
      authHeader,
    });
    if (result.status >= 400) return false;
    const rows = normalizeList(result.data).data;
    const match = rows.some((row) => {
      if (!row || typeof row !== "object") return false;
      const rec = row as Record<string, unknown>;
      return (
        rec["_id"] === claims.id &&
        typeof rec["email"] === "string" &&
        rec["email"].toLowerCase() === claims.email.toLowerCase()
      );
    });
    if (match) verifiedAdmins.set(key, Date.now());
    return match;
  } catch {
    return false;
  }
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Public, branded "What's New" page. Mounted OUTSIDE /api (see app.ts) so the
 * email button can link to a clean URL like https://admin.pointifypos.com/whats-new.
 */
export function renderWhatsNewPage(): string {
  const { entries, updatedAt } = readWhatsNew();
  const items = entries.length
    ? entries
        .map(
          (e) => `
      <div style="background:#ffffff; border-radius:12px; padding:24px 28px; margin-bottom:16px; box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        ${e.date ? `<div style="font-size:12px; font-weight:bold; color:#2563eb; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${escapeHtml(e.date)}</div>` : ""}
        <div style="font-size:18px; font-weight:bold; color:#111827; margin-bottom:8px;">${escapeHtml(e.title)}</div>
        ${e.body ? `<div style="font-size:15px; line-height:1.7; color:#374151; white-space:pre-wrap;">${escapeHtml(e.body)}</div>` : ""}
      </div>`,
        )
        .join("")
    : `<div style="background:#ffffff; border-radius:12px; padding:32px; text-align:center; color:#6b7280;">Nothing here yet — check back soon!</div>`;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>What's New — Pointify POS</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial,Helvetica,sans-serif;">
  <div style="background:#2563eb; padding:28px 20px; text-align:center;">
    <div style="font-size:26px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">Pointify <span style="color:#bfdbfe;">POS</span></div>
    <div style="font-size:13px; color:#bfdbfe; margin-top:4px;">Smart selling, simple business</div>
  </div>
  <div style="max-width:680px; margin:0 auto; padding:32px 16px;">
    <h1 style="font-size:24px; color:#111827; margin:0 0 4px 0;">What's New</h1>
    <p style="color:#6b7280; margin:0 0 24px 0; font-size:14px;">The latest updates and improvements in Pointify POS.${updatedAt ? ` Last updated ${escapeHtml(new Date(updatedAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }))}.` : ""}</p>
    ${items}
    <div style="text-align:center; margin:32px 0;">
      <a href="https://pointifypos.com/download" style="background:#2563eb; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">Get the App</a>
    </div>
  </div>
  <div style="background:#1e3a8a; padding:24px 20px; text-align:center;">
    <div style="font-size:13px; font-weight:bold; color:#ffffff;">Pointify POS</div>
    <div style="font-size:12px; color:#bfdbfe; margin:6px 0 10px 0;">The point of sale that fits in your pocket.</div>
    <a href="https://pointifypos.com" style="color:#93c5fd; font-size:12px; text-decoration:none; font-weight:bold;">pointifypos.com</a>
    <div style="font-size:11px; color:#93a8dd; margin-top:12px;">&copy; ${year} Pointify POS. All rights reserved.</div>
  </div>
</body>
</html>`;
}

router.get("/whats-new", (_req, res) => {
  res.status(200).json(readWhatsNew());
});

router.put("/whats-new", async (req, res) => {
  const claims = claimsFromAuth(req.headers.authorization);
  if (!claims) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (!(await isRealAdmin(claims, req.headers.authorization))) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Each entry needs a title (max 200 chars); body max 2000 chars." });
    return;
  }
  const content: WhatsNewContent = {
    entries: parsed.data.entries,
    updatedAt: new Date().toISOString(),
  };
  try {
    writeWhatsNew(content);
  } catch (err) {
    req.log.error({ err }, "Failed to write whats-new file");
    res.status(500).json({ message: "Failed to save What's New content" });
    return;
  }
  res.status(200).json(content);
});

export default router;
