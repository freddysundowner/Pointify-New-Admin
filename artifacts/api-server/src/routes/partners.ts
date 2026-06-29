import { Router, type IRouter, type Request, type Response } from "express";
import { upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

// Upstream mounts `/affiliates/` without any token check, so the proxy must
// enforce auth itself for these partner-management endpoints (they expose PII
// and account access). Mirrors the gate used by statistics/sms routes.
function requireBearer(req: Request, res: Response): boolean {
  const authHeader = authHeaderFrom(req);
  if (!authHeader || !/^Bearer\s+\S+$/.test(authHeader)) {
    res.status(401).json({ message: "Authentication required" });
    return false;
  }
  return true;
}

// Affiliate objects (and the `admins` the upstream embeds in list responses)
// carry secret fields the upstream returns unprojected. Strip them everywhere.
function stripSecrets(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const { password: _p, otp: _o, otp_expiry: _e, ...rest } = obj as Record<string, unknown>;
  return rest;
}

function sanitizePartner(p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  const cleaned = stripSecrets(p) as Record<string, unknown>;
  // The list endpoint embeds the partner's related admins (with their own
  // password/otp hashes) — sanitize those nested objects too.
  if (Array.isArray(cleaned["admins"])) {
    cleaned["admins"] = (cleaned["admins"] as unknown[]).map(stripSecrets);
  }
  return cleaned;
}

router.get("/partners", async (req, res) => {
  if (!requireBearer(req, res)) return;
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "20"), 10) || 20);
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/affiliates/",
      query: { page, limit },
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const norm = normalizeList(result.data);

    // The upstream `/affiliates/` list now embeds each partner's correctly
    // attributed `shops` and `admins` (shops owned by the admins the partner
    // referred). Derive the counts from those arrays in this single call, then
    // drop the heavy arrays so the list payload stays small.
    const partners = norm.data.map((raw) => {
      const partner = sanitizePartner(raw) as Record<string, unknown>;
      partner["shopCount"] = Array.isArray(partner["shops"]) ? partner["shops"].length : 0;
      partner["userCount"] = Array.isArray(partner["admins"]) ? partner["admins"].length : 0;
      delete partner["shops"];
      delete partner["admins"];
      return partner;
    });

    res.status(200).json({
      data: partners,
      count: norm.count,
      totalPages: norm.totalPages,
      currentPage: norm.currentPage,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list partners");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

// Register via the upstream affiliate registration endpoint so the password is
// hashed (auto-generated when omitted) and a referral code is created. A
// duplicate email surfaces as an upstream 400 that the client handles as an error.
router.post("/partners", async (req, res) => {
  if (!requireBearer(req, res)) return;
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: "/affiliates/auth/register",
      body: req.body,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    // The register response carries a partner auth token; never forward it to
    // the admin client.
    let body = result.data;
    if (body && typeof body === "object") {
      const { token: _token, ...rest } = body as Record<string, unknown>;
      body = rest;
    }
    res.status(result.status).json(body);
  } catch (err) {
    req.log.error({ err }, "Failed to create partner");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

// Transactions (subscription earnings + withdrawals) for a single partner.
// Upstream `/payments/transactions?id=<affiliateId>` populates the `affliate`
// (with secrets) — strip those; the `user` is already projected safely upstream.
router.get("/partners/transactions", async (req, res) => {
  if (!requireBearer(req, res)) return;
  const q = req.query as Record<string, unknown>;
  const id = (q["id"] as string | undefined)?.trim();
  if (!id) {
    res.status(400).json({ message: "Missing partner id" });
    return;
  }
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "30"), 10) || 30);
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/payments/transactions",
      query: { id, page, limit },
      authHeader: authHeaderFrom(req),
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
          // Upstream projects `user` to username/phone, but don't rely on that —
          // strip secrets defensively from both populated relations.
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
    req.log.error({ err }, "Failed to list partner transactions");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.get("/partners/:id", async (req, res) => {
  if (!requireBearer(req, res)) return;
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: `/affiliates/${req.params.id}`,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(sanitizePartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Failed to get partner");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.put("/partners/:id", async (req, res) => {
  if (!requireBearer(req, res)) return;
  try {
    const result = await upstreamFetch({
      method: "PUT",
      path: `/affiliates/${req.params.id}`,
      body: req.body,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(sanitizePartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Failed to update partner");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

// Credit (add funds to) a partner's wallet. Upstream has no atomic increment
// for affiliates, so read-modify-write: fetch the current wallet, add the
// requested amount, then PUT the new total. Admin-only, low-concurrency, so the
// race window is acceptable.
router.post("/partners/:id/credit", async (req, res) => {
  if (!requireBearer(req, res)) return;

  const raw = (req.body as Record<string, unknown> | undefined)?.["amount"];
  const amount = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ message: "Amount must be a positive number" });
    return;
  }

  try {
    const current = await upstreamFetch({
      method: "GET",
      path: `/affiliates/${req.params.id}`,
      authHeader: authHeaderFrom(req),
    });
    if (current.status >= 400) {
      res.status(current.status).json(current.data);
      return;
    }
    const partner = (current.data ?? {}) as Record<string, unknown>;
    // Fail closed on money math: an unset wallet is the model default (0), but a
    // present-yet-non-numeric balance must NOT be coerced to 0 — that would wipe
    // a real balance. Reject instead so we never write a wrong total.
    const rawBalance = partner["wallet"];
    let balance: number;
    if (rawBalance === null || rawBalance === undefined) {
      balance = 0;
    } else {
      balance = Number(rawBalance);
      if (!Number.isFinite(balance)) {
        req.log.error(
          { rawBalance },
          "Partner wallet is non-numeric; refusing to credit",
        );
        res
          .status(502)
          .json({ message: "Partner wallet balance is invalid upstream" });
        return;
      }
    }
    const newWallet = balance + amount;

    const result = await upstreamFetch({
      method: "PUT",
      path: `/affiliates/${req.params.id}`,
      body: { wallet: newWallet },
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(sanitizePartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Failed to credit partner wallet");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.delete("/partners/:id", async (req, res) => {
  if (!requireBearer(req, res)) return;
  try {
    const result = await upstreamFetch({
      method: "DELETE",
      path: `/affiliates/${req.params.id}`,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    res.status(200).json(sanitizePartner(result.data));
  } catch (err) {
    req.log.error({ err }, "Failed to delete partner");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

export default router;
