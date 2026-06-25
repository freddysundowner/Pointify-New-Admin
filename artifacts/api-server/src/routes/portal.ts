import { Router, type IRouter, type Request, type Response } from "express";
import { upstreamFetch, normalizeList } from "../lib/upstream";
import {
  signPortalSession,
  verifyPortalSession,
  affiliateIdFromUpstreamToken,
  type PortalSession,
} from "../lib/portalSession";

const router: IRouter = Router();

/**
 * Partner self-service portal. Every authed endpoint derives the affiliate id
 * from a proxy-signed session token (minted at login/register, verified here),
 * NEVER from a client-supplied id or an unverified upstream JWT — so a partner
 * can only ever see or act on their own data. See lib/portalSession.ts for why
 * the proxy must sign its own token rather than trust the upstream JWT.
 */
function bearerToken(req: Request): string | undefined {
  const match = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? "");
  return match ? match[1] : undefined;
}

function requireSession(req: Request, res: Response): PortalSession | undefined {
  const session = verifyPortalSession(bearerToken(req));
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return undefined;
  }
  return session;
}

// Bearer header forwarded upstream on a partner's behalf (the upstream token the
// proxy stashed inside the verified session, not the client's session token).
function upstreamAuth(session: PortalSession): string | undefined {
  return session.ut ? `Bearer ${session.ut}` : undefined;
}

function stripSecrets(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const { password: _p, otp: _o, otp_expiry: _e, ...rest } = obj as Record<string, unknown>;
  return rest;
}

function sanitizePartner(p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  const cleaned = stripSecrets(p) as Record<string, unknown>;
  if (Array.isArray(cleaned["admins"])) {
    cleaned["admins"] = (cleaned["admins"] as unknown[]).map(stripSecrets);
  }
  if (Array.isArray(cleaned["shops"])) {
    cleaned["shops"] = (cleaned["shops"] as unknown[]).map(stripSecrets);
  }
  return cleaned;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Replace the upstream token in an auth response with a proxy-signed session
// token (carrying the affiliate id + upstream token). Returns undefined if the
// affiliate id can't be derived, so the caller can fail closed.
function withSessionToken(data: unknown): Record<string, unknown> | undefined {
  const body = (data ?? {}) as Record<string, unknown>;
  const upstreamToken = typeof body["token"] === "string" ? body["token"] : "";
  const userdata =
    body["userdata"] && typeof body["userdata"] === "object"
      ? (body["userdata"] as Record<string, unknown>)
      : undefined;
  const aid =
    affiliateIdFromUpstreamToken(upstreamToken) ??
    (typeof userdata?.["_id"] === "string" ? (userdata["_id"] as string) : undefined);
  if (!aid) return undefined;
  return { ...body, token: signPortalSession({ aid, ut: upstreamToken }) };
}

// --- Public auth endpoints ---------------------------------------------------

// Self-registration. The upstream hashes the password, generates a referral
// code, and emails a welcome message. Strip any client attempt to set
// account-control fields (commission, wallet, blocked, active, code) so a
// registrant cannot grant themselves a commission rate or balance.
router.post("/portal/auth/register", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    commission: _c,
    wallet: _w,
    blocked: _b,
    active: _a,
    code: _code,
    _id: _id,
    ...safe
  } = body;
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: "/affiliates/auth/register",
      body: safe,
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const issued = withSessionToken(result.data);
    if (!issued) {
      req.log.error("Portal register: could not derive affiliate id from upstream token");
      res.status(502).json({ error: "Upstream request failed" });
      return;
    }
    res.status(201).json(issued);
  } catch (err) {
    req.log.error({ err }, "Portal register failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

router.post("/portal/auth/login", async (req, res) => {
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: "/affiliates/auth/login",
      body: req.body,
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const issued = withSessionToken(result.data);
    if (!issued) {
      req.log.error("Portal login: could not derive affiliate id from upstream token");
      res.status(502).json({ error: "Upstream request failed" });
      return;
    }
    res.status(200).json(issued);
  } catch (err) {
    req.log.error({ err }, "Portal login failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// --- Authenticated self endpoints -------------------------------------------

router.get("/portal/me", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: `/affiliates/${session.aid}`,
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(sanitizePartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Portal profile fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Update own profile. Changing the password triggers an upstream confirmation
// email. Strip every field that would let a partner escalate their own account
// (wallet, commission, blocked, active, code, otp) or target another record.
router.put("/portal/me", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const {
    wallet: _w,
    commission: _c,
    blocked: _b,
    active: _a,
    code: _code,
    otp: _o,
    otp_expiry: _e,
    _id: _id,
    shops: _shops,
    admins: _admins,
    ...safe
  } = body;
  try {
    const result = await upstreamFetch({
      method: "PUT",
      path: `/affiliates/${session.aid}`,
      body: safe,
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(sanitizePartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Portal profile update failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Shops owned by users this partner referred.
router.get("/portal/shops", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "20"), 10) || 20);
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/shop/",
      query: { affliate: session.aid },
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const norm = normalizeList(result.data);
    const all = norm.data.map(stripSecrets);
    const count = all.length;
    const totalPages = Math.max(1, Math.ceil(count / limit));
    // Clamp out-of-range requests (e.g. stale page after data shrinks) so the
    // client never receives an empty page that actually has results elsewhere.
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    res.status(200).json({
      data: all.slice(start, start + limit),
      count,
      totalPages,
      currentPage: safePage,
    });
  } catch (err) {
    req.log.error({ err }, "Portal shops fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Users (shop owners) this partner referred.
router.get("/portal/users", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "20"), 10) || 20);
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/admin/",
      query: { affliate: session.aid, page, limit },
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const norm = normalizeList(result.data);
    res.status(200).json({
      data: norm.data.map(stripSecrets),
      count: norm.count,
      totalPages: norm.totalPages,
      currentPage: norm.currentPage,
    });
  } catch (err) {
    req.log.error({ err }, "Portal users fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Earnings (type "subscription") and withdrawals (type "withdraw").
router.get("/portal/transactions", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "30"), 10) || 30);
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/payments/transactions",
      query: { id: session.aid, page, limit },
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const norm = normalizeList(result.data);
    res.status(200).json({
      data: norm.data.map((t) => {
        if (t && typeof t === "object") {
          const row = t as Record<string, unknown>;
          if (row["affliate"] && typeof row["affliate"] === "object") {
            row["affliate"] = stripSecrets(row["affliate"]);
          }
          if (row["user"] && typeof row["user"] === "object") {
            row["user"] = stripSecrets(row["user"]);
          }
          return row;
        }
        return t;
      }),
      count: norm.count,
      totalPages: norm.totalPages,
      currentPage: norm.currentPage,
    });
  } catch (err) {
    req.log.error({ err }, "Portal transactions fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Dashboard totals, composed server-side from the partner profile, their shops
// and referred users, and their full transaction history.
router.get("/portal/summary", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const authHeader = upstreamAuth(session);
  const aid = session.aid;
  try {
    const [profileRes, shopsRes, usersRes, txRes] = await Promise.all([
      upstreamFetch({ method: "GET", path: `/affiliates/${aid}`, authHeader }),
      upstreamFetch({ method: "GET", path: "/shop/", query: { affliate: aid }, authHeader }),
      upstreamFetch({
        method: "GET",
        path: "/admin/",
        query: { affliate: aid, page: 1, limit: 100000 },
        authHeader,
      }),
      upstreamFetch({
        method: "GET",
        path: "/payments/transactions",
        query: { id: aid, page: 1, limit: 100000 },
        authHeader,
      }),
    ]);

    // Fail closed: if any upstream call errors, surface it rather than returning
    // a 200 with synthesized zero/null metrics that look like real (empty) data.
    for (const r of [profileRes, shopsRes, usersRes, txRes]) {
      if (r.status >= 400) {
        res.status(502).json({ error: "Upstream request failed" });
        return;
      }
    }

    const profile = (profileRes.data ?? {}) as Record<string, unknown>;
    const shopCount = normalizeList(shopsRes.data).data.length;
    const userCount = normalizeList(usersRes.data).count;
    const txns = normalizeList(txRes.data).data as Array<Record<string, unknown>>;

    let totalEarned = 0;
    let totalWithdrawn = 0;
    let pendingWithdrawals = 0;
    for (const t of txns) {
      const type = String(t["type"] ?? "");
      if (type === "subscription") {
        totalEarned += num(t["affliateAmount"]);
      } else if (type === "withdraw") {
        if (t["status"] === true) totalWithdrawn += num(t["amount"]);
        else pendingWithdrawals += num(t["amount"]);
      }
    }

    res.status(200).json({
      wallet: num(profile["wallet"]),
      commission: profile["commission"] ?? null,
      code: profile["code"] ?? null,
      shopCount,
      userCount,
      totalEarned,
      totalWithdrawn,
      pendingWithdrawals,
    });
  } catch (err) {
    req.log.error({ err }, "Portal summary failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Request a wallet withdrawal. This triggers a REAL M-Pesa B2C payout upstream.
// The affiliate id is taken from the token. Upstream reports insufficient
// balance / blocked account inside an HTTP 200 body as { status: false }, so
// pass the upstream status and body straight through for the client to branch on.
router.post("/portal/withdraw", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: `/payments/awards/withdraw/${session.aid}`,
      body: { amount: body["amount"], phonenumber: body["phonenumber"] },
      authHeader: upstreamAuth(session),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    req.log.error({ err }, "Portal withdrawal failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

export default router;
