import type { Request, Response } from "express";
import { verifyAdminSession } from "./adminAuth";

const DEFAULT_BASE = "https://api.pointifypos.com";

/**
 * Hard cap on how long we wait for the upstream POS API before giving up.
 * The platform reverse proxy cuts hanging requests at ~50s with a generic 504;
 * we abort earlier so we can return a clear, actionable message instead. No
 * legitimate upstream endpoint takes anywhere near this long (reads are sub-second,
 * STK push ~1.5s). A long hang means an upstream stall (e.g. its M-Pesa B2C call
 * to Safaricom not responding), which we surface as a 504 rather than a dead wait.
 */
const UPSTREAM_TIMEOUT_MS = 30_000;

export class UpstreamTimeoutError extends Error {
  constructor(path: string) {
    super(`Upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms: ${path}`);
    this.name = "UpstreamTimeoutError";
  }
}

export function upstreamBase(): string {
  const raw = process.env["POS_API_BASE_URL"]?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_BASE;
  return base.replace(/\/+$/, "");
}

export interface UpstreamResult {
  status: number;
  data: unknown;
}

export interface UpstreamRequest {
  method: string;
  path: string;
  query?: Record<string, unknown> | undefined;
  body?: unknown;
  authHeader?: string | undefined;
  // Extra request headers (e.g. a proxy→upstream shared secret). Merged after
  // the defaults so they can override Content-Type/Accept if ever needed.
  headers?: Record<string, string> | undefined;
}

export async function upstreamFetch(
  opts: UpstreamRequest,
): Promise<UpstreamResult> {
  const url = new URL(upstreamBase() + opts.path);

  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.authHeader) headers["Authorization"] = opts.authHeader;
  if (opts.headers) Object.assign(headers, opts.headers);

  const init: RequestInit = { method: opts.method, headers };
  const method = opts.method.toUpperCase();
  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(opts.body);
  }

  let resp: Awaited<ReturnType<typeof fetch>>;
  try {
    resp = await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new UpstreamTimeoutError(opts.path);
    }
    throw err;
  }
  const text = await resp.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: resp.status, data };
}

/**
 * Authorization header to send to the POS API.
 *
 * After login the browser holds THIS proxy's own session token (signed with SESSION_SECRET, see
 * lib/adminAuth.ts). The POS API now verifies tokens with its own secret, so forwarding the session
 * token verbatim is rejected (401). The session carries the upstream staff token (`ut`): send that.
 * Anything that is not one of our sessions is forwarded unchanged.
 */
export function authHeaderFrom(req: Request): string | undefined {
  const header = req.headers["authorization"];
  if (typeof header !== "string" || header.length === 0) return undefined;
  const session = verifyAdminSession(header);
  if (session) return session.ut ? `Bearer ${session.ut}` : undefined;
  return header;
}

/**
 * Proxy a request to the upstream POS API and forward the response verbatim.
 */
export async function proxy(
  req: Request,
  res: Response,
  opts: { method: string; path: string; query?: Record<string, unknown> | undefined; body?: unknown },
): Promise<void> {
  try {
    const result = await upstreamFetch({
      method: opts.method,
      path: opts.path,
      query: opts.query,
      body: opts.body,
      authHeader: authHeaderFrom(req),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      req.log.error({ err, path: opts.path }, "Upstream request timed out");
      res.status(504).json({
        message:
          "The POS server did not respond in time. For M-Pesa payouts this usually means the upstream B2C request to Safaricom stalled. Please try again, and if it persists check the POS server's M-Pesa configuration.",
      });
      return;
    }
    req.log.error({ err, path: opts.path }, "Upstream request failed");
    res.status(502).json({ message: "Upstream request failed" });
  }
}

interface NormalizedList {
  data: unknown[];
  count: number;
  totalPages: number;
  currentPage: number;
}

const LIST_KEYS = [
  "data",
  "results",
  "docs",
  "admins",
  "shops",
  "products",
  "categories",
  "attendants",
  "sales",
  "purchases",
  "subscriptions",
  "packages",
  "logs",
  "communications",
  "items",
];

export function normalizeList(raw: unknown): NormalizedList {
  if (Array.isArray(raw)) {
    return { data: raw, count: raw.length, totalPages: 1, currentPage: 1 };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    let arr: unknown[] = [];
    for (const key of LIST_KEYS) {
      if (Array.isArray(o[key])) {
        arr = o[key] as unknown[];
        break;
      }
    }
    const num = (...candidates: unknown[]): number | undefined => {
      for (const c of candidates) {
        if (c === undefined || c === null) continue;
        const n = Number(c);
        if (!Number.isNaN(n)) return n;
      }
      return undefined;
    };
    // Some upstream endpoints (e.g. attendants `/all/:id`) nest paging info
    // under a `pagination` object: { attendants, pagination: { total, page, limit } }.
    const pg =
      o["pagination"] && typeof o["pagination"] === "object"
        ? (o["pagination"] as Record<string, unknown>)
        : {};
    const count =
      num(o["count"], o["total"], pg["total"], o["totalAdmins"], o["totalShops"], o["totalDocs"], o["totalDoc"]) ??
      arr.length;
    const limit = num(o["limit"], pg["limit"]);
    // Some upstream endpoints (e.g. purchases) return { total, page, limit } but
    // no totalPages, so derive it from count/limit when we have a page size.
    const derivedPages = limit && limit > 0 ? Math.ceil(count / limit) : undefined;
    return {
      data: arr,
      count,
      totalPages: num(o["totalPages"], o["pages"], pg["totalPages"]) ?? derivedPages ?? 1,
      currentPage: num(o["currentPage"], o["page"], pg["page"]) ?? 1,
    };
  }
  return { data: [], count: 0, totalPages: 1, currentPage: 1 };
}

/**
 * Proxy a list endpoint, normalizing the upstream response into
 * { data, count, totalPages, currentPage }.
 */
export async function proxyList(
  req: Request,
  res: Response,
  opts: { path: string; query?: Record<string, unknown> | undefined },
): Promise<void> {
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: opts.path,
      query: opts.query,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(normalizeList(result.data));
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      req.log.error({ err, path: opts.path }, "Upstream list request timed out");
      res.status(504).json({ message: "The POS server did not respond in time. Please try again." });
      return;
    }
    req.log.error({ err, path: opts.path }, "Upstream list request failed");
    res.status(502).json({ message: "Upstream request failed" });
  }
}
