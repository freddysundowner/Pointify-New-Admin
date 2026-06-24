import type { Request, Response } from "express";

const DEFAULT_BASE = "https://api.pointifypos.com";

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

  const init: RequestInit = { method: opts.method, headers };
  const method = opts.method.toUpperCase();
  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(opts.body);
  }

  const resp = await fetch(url, init);
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

export function authHeaderFrom(req: Request): string | undefined {
  const header = req.headers["authorization"];
  if (typeof header === "string" && header.length > 0) return header;
  return undefined;
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
    const count =
      num(o["count"], o["total"], o["totalAdmins"], o["totalShops"], o["totalDocs"], o["totalDoc"]) ?? arr.length;
    const limit = num(o["limit"]);
    // Some upstream endpoints (e.g. purchases) return { total, page, limit } but
    // no totalPages, so derive it from count/limit when we have a page size.
    const derivedPages = limit && limit > 0 ? Math.ceil(count / limit) : undefined;
    return {
      data: arr,
      count,
      totalPages: num(o["totalPages"], o["pages"]) ?? derivedPages ?? 1,
      currentPage: num(o["currentPage"], o["page"]) ?? 1,
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
    req.log.error({ err, path: opts.path }, "Upstream list request failed");
    res.status(502).json({ message: "Upstream request failed" });
  }
}
