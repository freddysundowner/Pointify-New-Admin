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

// Optional shared secret proving a `/leads` request came from THIS proxy (the
// only place the affiliate id is derived from a verified session). When
// LEADS_PROXY_SECRET is set here AND on the upstream, the upstream can reject any
// direct caller and refuse to trust a forged `affiliate` — closing the
// cross-partner (IDOR) gap. Omitted when unset, so it is a no-op until enabled.
function leadsProxyHeaders(): Record<string, string> | undefined {
  const secret = process.env.LEADS_PROXY_SECRET;
  return secret ? { "x-proxy-secret": secret } : undefined;
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
    parent: _parent,
    subCommission: _sc,
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
    parent: _parent,
    subCommission: _sc,
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
    let norm = normalizeList(result.data);
    // Upstream does NOT clamp out-of-range pages (page beyond total returns
    // empty `data`). Re-fetch the last valid page so the client never lands on
    // an empty page while users exist on earlier pages.
    const safePage = Math.min(page, Math.max(1, norm.totalPages));
    if (safePage !== page) {
      const reFetch = await upstreamFetch({
        method: "GET",
        path: "/admin/",
        query: { affliate: session.aid, page: safePage, limit },
        authHeader: upstreamAuth(session),
      });
      if (reFetch.status < 400) {
        norm = normalizeList(reFetch.data);
      }
    }
    res.status(200).json({
      data: norm.data.map(stripSecrets),
      count: norm.count,
      totalPages: norm.totalPages,
      currentPage: Math.min(norm.currentPage, Math.max(1, norm.totalPages)),
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
    let norm = normalizeList(result.data);
    // Upstream does NOT clamp out-of-range pages (e.g. page=999 returns empty
    // `data` but still `page:999`). Re-fetch the last valid page so the client
    // never lands on an empty page while transactions exist on earlier pages.
    const safePage = Math.min(page, Math.max(1, norm.totalPages));
    if (safePage !== page) {
      const reFetch = await upstreamFetch({
        method: "GET",
        path: "/payments/transactions",
        query: { id: session.aid, page: safePage, limit },
        authHeader: upstreamAuth(session),
      });
      if (reFetch.status < 400) {
        norm = normalizeList(reFetch.data);
      }
    }
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
      currentPage: Math.min(norm.currentPage, Math.max(1, norm.totalPages)),
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

// --- Lead-tracking CRM (partner-owned) --------------------------------------
//
// Leads live in the upstream MongoDB (a new `/leads` collection/route the POS
// server owns). Every request here is scoped to the partner's own affiliate id
// (session.aid) — injected server-side and never trusted from the client — so a
// partner can only ever see or touch their own leads. The upstream additionally
// scopes every query by that affiliate id as defence in depth.

// The seven confirmed pipeline stages, in order. Used to shape the stats
// response so every stage always appears (even at zero).
const LEAD_STAGES = [
  "New Lead",
  "Contacted",
  "Interested",
  "Visit/Demo Scheduled",
  "Negotiating",
  "Won (Converted)",
  "Lost",
] as const;

// Stages that count as an open/active lead (a follow-up still matters). Won/Lost
// are terminal, so their follow-up dates never count as overdue.
const CLOSED_STAGES = new Set<string>(["Won (Converted)", "Lost"]);

// Only these fields may be written from the client; everything else (affiliate,
// _id, timestamps) is set/owned by the proxy or upstream.
const LEAD_FIELDS = [
  "businessName",
  "contactPerson",
  "phonenumber",
  "businessType",
  "location",
  "source",
  "stage",
  "nextFollowUpDate",
  "notes",
] as const;

function pickLeadFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LEAD_FIELDS) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

// A calendar date string (yyyy-mm-dd) in East Africa Time. Follow-up dates are
// day-granular, and the whole platform operates in EAT, so bucket by EAT day.
function eatDateStr(d: Date): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// GET /portal/shop-categories — the global shop-category list, reused as the
// "Business Type" options when creating/editing a lead. Small global list, so
// upstream `/shop/category` returns a bare array; return it as ShopCategory[].
router.get("/portal/shop-categories", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/shop/category",
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(normalizeList(result.data).data);
  } catch (err) {
    req.log.error({ err }, "Portal shop categories fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// Resolves which affiliate ids a leads READ is scoped to, honouring the
// optional `partner` query param:
//   - absent          -> the caller's own leads
//   - "all"           -> caller + every sub-partner (masters only)
//   - <subPartnerId>  -> that sub-partner's leads (masters only, must be theirs)
// Writes stay own-only — a master can view but never edit a sub's leads.
// Returns the id list, or undefined after having written the error response.
async function resolveLeadScope(
  req: Request,
  res: Response,
  session: PortalSession,
): Promise<string[] | undefined> {
  const partner = String((req.query as Record<string, unknown>)["partner"] ?? "").trim();
  if (!partner) return [session.aid];

  // Only masters may widen the scope. One upstream list call gives us both the
  // caller's own record (parent check) and their sub-partners.
  const result = await upstreamFetch({
    method: "GET",
    path: "/affiliates/",
    authHeader: upstreamAuth(session),
  });
  if (result.status >= 400) {
    res.status(502).json({ error: "Upstream request failed" });
    return undefined;
  }
  const all = normalizeList(result.data).data as Array<Record<string, unknown>>;
  const me = all.find((p) => String(p["_id"] ?? "") === session.aid);
  if (!me || parentIdOf(me)) {
    res.status(403).json({ error: "Only master partners can view team leads" });
    return undefined;
  }
  const subIds = all
    .filter((p) => parentIdOf(p) === session.aid)
    .map((p) => String(p["_id"] ?? ""))
    .filter((id) => id !== "");

  if (partner === "all") return [session.aid, ...subIds];
  if (partner === session.aid) return [session.aid];
  if (subIds.includes(partner)) return [partner];
  res.status(404).json({ error: "Sub-partner not found" });
  return undefined;
}

// GET /portal/leads — the partner's leads, filterable by stage/source/search.
// Masters may widen the scope to their team via `partner` (see resolveLeadScope).
router.get("/portal/leads", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "20"), 10) || 20);
  try {
    const scope = await resolveLeadScope(req, res, session);
    if (!scope) return;
    const result = await upstreamFetch({
      method: "GET",
      path: "/leads",
      query: {
        affiliate: scope.join(","),
        page,
        limit,
        stage: q["stage"],
        source: q["source"],
        search: q["search"],
      },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const norm = normalizeList(result.data);
    res.status(200).json({
      data: norm.data,
      count: norm.count,
      totalPages: norm.totalPages,
      currentPage: Math.min(norm.currentPage, Math.max(1, norm.totalPages)),
    });
  } catch (err) {
    req.log.error({ err }, "Portal leads fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// GET /portal/leads/stats — pipeline counts per stage + follow-up alerts.
// Composed server-side from the partner's full lead set. Declared BEFORE the
// `/:id` routes so "stats" isn't captured as an id. Accepts the same optional
// `partner` scope as the list (masters only).
router.get("/portal/leads/stats", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const scope = await resolveLeadScope(req, res, session);
    if (!scope) return;
    const result = await upstreamFetch({
      method: "GET",
      path: "/leads",
      query: { affiliate: scope.join(","), page: 1, limit: 100000 },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const leads = normalizeList(result.data).data as Array<Record<string, unknown>>;
    const today = eatDateStr(new Date());

    const byStage: Record<string, number> = {};
    for (const stage of LEAD_STAGES) byStage[stage] = 0;
    let overdue = 0;
    let dueToday = 0;
    for (const lead of leads) {
      const stage = String(lead["stage"] ?? "New Lead");
      byStage[stage] = (byStage[stage] ?? 0) + 1;
      const raw = lead["nextFollowUpDate"];
      if (raw && !CLOSED_STAGES.has(stage)) {
        const when = eatDateStr(new Date(String(raw)));
        if (when < today) overdue += 1;
        else if (when === today) dueToday += 1;
      }
    }
    const total = leads.length;
    const won = byStage["Won (Converted)"] ?? 0;
    res.status(200).json({
      total,
      won,
      overdue,
      dueToday,
      byStage: LEAD_STAGES.map((stage) => ({ stage, count: byStage[stage] ?? 0 })),
    });
  } catch (err) {
    req.log.error({ err }, "Portal lead stats failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// POST /portal/leads — create a lead owned by this partner.
router.post("/portal/leads", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const safe = pickLeadFields((req.body ?? {}) as Record<string, unknown>);
  if (!safe["businessName"] || String(safe["businessName"]).trim() === "") {
    res.status(400).json({ error: "Business name is required" });
    return;
  }
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: "/leads",
      body: { ...safe, affiliate: session.aid },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    req.log.error({ err }, "Portal lead create failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// GET /portal/leads/:id — a single lead. Tries the caller's own leads first;
// on a 404, a MASTER partner's read is widened to their sub-partners so they
// can open a team member's lead (read-only — writes below stay own-only).
router.get("/portal/leads/:id", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const own = await upstreamFetch({
      method: "GET",
      path: `/leads/${req.params.id}`,
      query: { affiliate: session.aid },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    if (own.status !== 404) {
      res.status(own.status).json(own.data);
      return;
    }

    // Not the caller's own lead. If they are a master with sub-partners, retry
    // scoped to the subs; otherwise the 404 stands.
    const partners = await upstreamFetch({
      method: "GET",
      path: "/affiliates/",
      authHeader: upstreamAuth(session),
    });
    if (partners.status >= 400) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const all = normalizeList(partners.data).data as Array<Record<string, unknown>>;
    const me = all.find((p) => String(p["_id"] ?? "") === session.aid);
    const subIds =
      me && !parentIdOf(me)
        ? all
            .filter((p) => parentIdOf(p) === session.aid)
            .map((p) => String(p["_id"] ?? ""))
            .filter((id) => id !== "")
        : [];
    if (subIds.length === 0) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const team = await upstreamFetch({
      method: "GET",
      path: `/leads/${req.params.id}`,
      query: { affiliate: subIds.join(",") },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    res.status(team.status).json(team.data);
  } catch (err) {
    req.log.error({ err }, "Portal lead fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// POST /portal/leads/:id/activities — append a free-text note to an OWNED
// lead's activity timeline. Scoped to session.aid, so a master can never write
// notes onto a sub-partner's lead.
router.post("/portal/leads/:id/activities", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const note = typeof body["note"] === "string" ? body["note"].trim() : "";
  if (!note) {
    res.status(400).json({ error: "Note is required" });
    return;
  }
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: `/leads/${req.params.id}/activities`,
      query: { affiliate: session.aid },
      body: { note },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    req.log.error({ err }, "Portal lead note failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// PUT /portal/leads/:id — update an owned lead. affiliate is scoped via query so
// a partner can never reassign a lead to (or edit) someone else's.
router.put("/portal/leads/:id", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const safe = pickLeadFields((req.body ?? {}) as Record<string, unknown>);
  try {
    const result = await upstreamFetch({
      method: "PUT",
      path: `/leads/${req.params.id}`,
      query: { affiliate: session.aid },
      body: safe,
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    req.log.error({ err }, "Portal lead update failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// DELETE /portal/leads/:id — delete an owned lead.
router.delete("/portal/leads/:id", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const result = await upstreamFetch({
      method: "DELETE",
      path: `/leads/${req.params.id}`,
      query: { affiliate: session.aid },
      authHeader: upstreamAuth(session),
      headers: leadsProxyHeaders(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    req.log.error({ err }, "Portal lead delete failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// --- Sub-partners (one level deep) -------------------------------------------
//
// A master partner (no `parent`) can create sub-partners who earn a percentage
// OF THE MASTER'S commission award. Upstream stores this as Affliate.parent +
// Affliate.subCommission; creation reuses the existing affiliate register
// endpoint (which emails a welcome message, generating a random password when
// none is supplied) followed by an update that links the new account to the
// caller. All ownership checks happen here against session.aid.

function parentIdOf(p: unknown): string | undefined {
  if (!p || typeof p !== "object") return undefined;
  const parent = (p as Record<string, unknown>)["parent"];
  if (typeof parent === "string" && parent) return parent;
  if (parent && typeof parent === "object") {
    const id = (parent as Record<string, unknown>)["_id"];
    if (typeof id === "string" && id) return id;
  }
  return undefined;
}

// Shape a raw affiliate record into the SubPartner response: strip secrets,
// collapse the heavy populated shops/admins arrays into counts, drop fields a
// master has no business seeing on their sub (parent is implied).
function toSubPartner(raw: unknown): Record<string, unknown> {
  const p = stripSecrets(raw) as Record<string, unknown>;
  const admins = Array.isArray(p["admins"]) ? (p["admins"] as unknown[]) : [];
  const shops = Array.isArray(p["shops"]) ? (p["shops"] as unknown[]) : [];
  const {
    admins: _admins,
    shops: _shops,
    parent: _parent,
    commission: _commission,
    ...rest
  } = p;
  return { ...rest, userCount: admins.length, shopCount: shops.length };
}

function validSubCommission(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : undefined;
}

// GET /portal/sub-partners — the caller's sub-partners. Upstream has no parent
// filter, so fetch the (small) full list and filter here. Subs get [].
router.get("/portal/sub-partners", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/affiliates/",
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const all = normalizeList(result.data).data;
    const mine = all.filter((p) => parentIdOf(p) === session.aid);
    res.status(200).json(mine.map(toSubPartner));
  } catch (err) {
    req.log.error({ err }, "Portal sub-partners fetch failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// POST /portal/sub-partners — create a sub-partner under the caller.
router.post("/portal/sub-partners", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = typeof body["name"] === "string" ? body["name"].trim() : "";
  const email = typeof body["email"] === "string" ? body["email"].trim() : "";
  const phonenumber =
    typeof body["phonenumber"] === "string" ? body["phonenumber"].trim() : "";
  const subCommission = validSubCommission(body["subCommission"]);
  if (!name || !email || !phonenumber) {
    res.status(400).json({ error: "Name, email and phone number are required" });
    return;
  }
  if (subCommission === undefined) {
    res.status(400).json({ error: "Share percentage must be between 1 and 99" });
    return;
  }

  try {
    // Only master partners may create sub-partners (one level deep).
    const meRes = await upstreamFetch({
      method: "GET",
      path: `/affiliates/${session.aid}`,
      authHeader: upstreamAuth(session),
    });
    if (meRes.status >= 400) {
      res.status(502).json({ error: "Upstream request failed" });
      return;
    }
    if (parentIdOf(meRes.data)) {
      res.status(403).json({ error: "Sub-partners cannot create their own sub-partners" });
      return;
    }

    // 1. Register the account upstream (hashes password, generates referral
    //    code, emails welcome — with the generated password when none given).
    const registerBody: Record<string, unknown> = { name, email, phonenumber };
    if (typeof body["country"] === "string" && body["country"].trim()) {
      registerBody["country"] = body["country"].trim();
    }
    if (typeof body["password"] === "string" && body["password"]) {
      registerBody["password"] = body["password"];
    }
    const created = await upstreamFetch({
      method: "POST",
      path: "/affiliates/auth/register",
      body: registerBody,
    });
    if (created.status >= 400) {
      res.status(created.status).json(created.data);
      return;
    }
    const createdBody = (created.data ?? {}) as Record<string, unknown>;
    const userdata =
      createdBody["userdata"] && typeof createdBody["userdata"] === "object"
        ? (createdBody["userdata"] as Record<string, unknown>)
        : undefined;
    const newId = typeof userdata?.["_id"] === "string" ? (userdata["_id"] as string) : undefined;
    if (!newId) {
      req.log.error("Sub-partner create: upstream register returned no id");
      res.status(502).json({ error: "Upstream request failed" });
      return;
    }

    // 2. Link it to the caller. If this fails the account would be a stray
    //    MASTER partner, so roll it back rather than leave it dangling.
    const linked = await upstreamFetch({
      method: "PUT",
      path: `/affiliates/${newId}`,
      body: { parent: session.aid, subCommission },
      authHeader: upstreamAuth(session),
    });
    if (linked.status >= 400) {
      req.log.error(
        { status: linked.status },
        "Sub-partner create: linking failed, rolling back registration",
      );
      try {
        await upstreamFetch({
          method: "DELETE",
          path: `/affiliates/${newId}`,
          authHeader: upstreamAuth(session),
        });
      } catch (rollbackErr) {
        req.log.error({ err: rollbackErr }, "Sub-partner create: rollback delete failed");
      }
      res.status(502).json({ error: "Could not finish creating the sub-partner. Please try again." });
      return;
    }

    res.status(201).json(toSubPartner(linked.data));
  } catch (err) {
    req.log.error({ err }, "Portal sub-partner create failed");
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// PUT /portal/sub-partners/:id — change the share %, suspend/unsuspend, or set
// a new login password. Ownership is verified against the live upstream record
// before writing. When a password is sent, upstream bcrypt-hashes it and emails
// the sub-partner a "password changed" notice — but that email template reads
// the recipient's name/email from the REQUEST BODY, so we must echo the current
// name/email alongside the password or the notification goes nowhere.
router.put("/portal/sub-partners/:id", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  if (body["subCommission"] !== undefined) {
    const subCommission = validSubCommission(body["subCommission"]);
    if (subCommission === undefined) {
      res.status(400).json({ error: "Share percentage must be between 1 and 99" });
      return;
    }
    update["subCommission"] = subCommission;
  }
  if (typeof body["blocked"] === "boolean") {
    update["blocked"] = body["blocked"];
  }
  let newPassword: string | undefined;
  if (body["password"] !== undefined) {
    if (typeof body["password"] !== "string" || body["password"].length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    newPassword = body["password"];
  }
  if (Object.keys(update).length === 0 && newPassword === undefined) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  try {
    const current = await upstreamFetch({
      method: "GET",
      path: `/affiliates/${req.params.id}`,
      authHeader: upstreamAuth(session),
    });
    if (current.status >= 400 || parentIdOf(current.data) !== session.aid) {
      res.status(404).json({ error: "Sub-partner not found" });
      return;
    }
    if (newPassword !== undefined) {
      const rec = (current.data ?? {}) as Record<string, unknown>;
      update["password"] = newPassword;
      if (typeof rec["name"] === "string") update["name"] = rec["name"];
      if (typeof rec["email"] === "string") update["email"] = rec["email"];
    }
    const result = await upstreamFetch({
      method: "PUT",
      path: `/affiliates/${req.params.id}`,
      body: update,
      authHeader: upstreamAuth(session),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(toSubPartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Portal sub-partner update failed");
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
