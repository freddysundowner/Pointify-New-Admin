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

    // The upstream embeds `shops` via `Shop.find({ affliate })`, but a shop's
    // `affliate` field is rarely set — the real attribution is shops owned by
    // admins the partner referred. The shop list endpoint computes this (it
    // resolves `affliate` -> referred admins -> shops by adminId), so derive an
    // accurate `shopCount` per partner from its `totalShops`. Done in parallel
    // to bound latency.
    const partners = await Promise.all(
      norm.data.map(async (raw) => {
        const partner = sanitizePartner(raw) as Record<string, unknown>;
        // Drop the heavy/misleading embedded arrays from the list payload.
        delete partner["shops"];
        delete partner["admins"];
        const id = partner["_id"];
        if (typeof id !== "string") {
          partner["shopCount"] = 0;
          return partner;
        }
        try {
          const shopResult = await upstreamFetch({
            method: "GET",
            path: "/shop/",
            query: { affliate: id, page: 1, limit: 1 },
            authHeader: authHeaderFrom(req),
          });
          partner["shopCount"] =
            shopResult.status < 400 ? normalizeList(shopResult.data).count : 0;
        } catch (err) {
          req.log.error({ err, partnerId: id }, "Failed to count partner shops");
          partner["shopCount"] = 0;
        }
        return partner;
      }),
    );

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
