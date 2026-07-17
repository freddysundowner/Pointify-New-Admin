import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom } from "../lib/upstream";
import { isVerifiedAdminRequest } from "../lib/adminAuth";

const router: IRouter = Router();

/**
 * "Current subscriptions" composition (?current=true).
 *
 * The upstream subscriptions collection keeps EVERY payment attempt (a row is
 * created before the M-Pesa STK push, so failed/abandoned attempts pile up).
 * The authoritative "in use" link is the SHOP record's `subscription` field,
 * which upstream only (re)points on successful payment/verify/extend/assign.
 * So the current view is composed from the shop list: each shop's populated
 * `subscription` (with packageId), deduplicated across shops (one subscription
 * can cover several shops), filtered and paginated proxy-side.
 */
const SHOPS_PAGE_LIMIT = 200;
const MAX_SHOP_PAGES = 50;

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;
}

router.get("/subscriptions", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const isCurrent = String(q["current"] ?? "").toLowerCase() === "true";
  if (!isCurrent) {
    await proxyList(req, res, { path: "/subscriptions/", query: q });
    return;
  }

  // Composed endpoint: enforce real admin auth ourselves (upstream is
  // permissive) — decode the token claims and cross-check them against the
  // upstream admin directory.
  const authHeader = authHeaderFrom(req);
  if (!(await isVerifiedAdminRequest(authHeader))) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  try {
    // 1. Collect every shop (paged) with its populated current subscription.
    const byId = new Map<string, { sub: Rec; shops: Rec[] }>();
    for (let pageNum = 1; pageNum <= MAX_SHOP_PAGES; pageNum++) {
      const result = await upstreamFetch({
        method: "GET",
        path: "/shop/",
        query: { page: pageNum, limit: SHOPS_PAGE_LIMIT },
        authHeader,
      });
      if (result.status >= 400) {
        res.status(result.status).json(result.data);
        return;
      }
      const body = asRec(result.data) ?? {};
      // Upstream /shop/ returns { shops, totalShops, totalPages, currentPage }.
      const rows: unknown[] = Array.isArray(body["shops"])
        ? (body["shops"] as unknown[])
        : Array.isArray(body["data"])
          ? (body["data"] as unknown[])
          : Array.isArray(result.data)
            ? (result.data as unknown[])
            : [];
      for (const raw of rows) {
        const shop = asRec(raw);
        if (!shop) continue;
        const sub = asRec(shop["subscription"]);
        const subId = sub ? String(sub["_id"] ?? "") : "";
        if (!sub || !subId) continue;
        const entry = byId.get(subId);
        if (entry) entry.shops.push(shop);
        else byId.set(subId, { sub, shops: [shop] });
      }
      if (rows.length < SHOPS_PAGE_LIMIT) break;
    }

    // 2. Shape rows like the normal list (shops populated for rendering).
    const now = new Date();
    let subs: Rec[] = Array.from(byId.values()).map(({ sub, shops }) => ({
      ...sub,
      shops,
      shop: shops[0] ?? sub["shop"],
    }));

    // 3. Proxy-side filters mirroring the upstream list semantics.
    const status = typeof q["status"] === "string" ? q["status"] : "";
    const type = typeof q["type"] === "string" ? q["type"] : "";
    const shopId = typeof q["shop"] === "string" ? q["shop"].trim() : "";
    const shopname =
      typeof q["shopname"] === "string" ? q["shopname"].trim().toLowerCase() : "";
    const invoiceNo = typeof q["invoiceNo"] === "string" ? q["invoiceNo"].trim() : "";

    const endDateOf = (s: Rec): Date | null => {
      const raw = s["endDate"];
      if (!raw) return null;
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d;
    };

    // Status semantics mirror the UI badge: trials are "active" purely by the
    // expiry window; production requires paid:true and a started window. The
    // upstream `status` boolean is NOT authoritative (status:true+paid:false
    // rows are unpaid attempts, not active).
    const startDateOf = (s: Rec): Date | null => {
      const raw = s["startDate"];
      if (!raw) return null;
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    if (status === "Active") {
      subs = subs.filter((s) => {
        const end = endDateOf(s);
        if (end === null || end <= now) return false;
        if (s["type"] === "trial") return true;
        const start = startDateOf(s);
        return s["paid"] === true && (start === null || start <= now);
      });
    } else if (status === "Expired") {
      subs = subs.filter((s) => {
        const end = endDateOf(s);
        return end !== null && end <= now;
      });
    } else if (status === "Cancelled") {
      subs = subs.filter((s) => s["type"] !== "trial" && s["paid"] !== true);
    }
    if (type) subs = subs.filter((s) => s["type"] === type);
    if (shopId) {
      subs = subs.filter((s) =>
        (s.shops as Rec[]).some((sh) => String(sh["_id"] ?? "") === shopId),
      );
    }
    if (shopname) {
      subs = subs.filter((s) =>
        (s.shops as Rec[]).some((sh) =>
          String(sh["name"] ?? "").toLowerCase().includes(shopname),
        ),
      );
    }
    if (invoiceNo) {
      subs = subs.filter((s) => String(s["invoiceNo"] ?? "").includes(invoiceNo));
    }
    // Date filters mirror upstream: createAt = single UTC day; expiry range on
    // endDate, honoured only when BOTH ends are present.
    const createAt = typeof q["createAt"] === "string" ? q["createAt"].trim() : "";
    if (createAt) {
      const dayStart = new Date(`${createAt}T00:00:00.000Z`).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      if (!Number.isNaN(dayStart)) {
        subs = subs.filter((s) => {
          const t = new Date(String(s["createAt"] ?? "")).getTime();
          return !Number.isNaN(t) && t >= dayStart && t < dayEnd;
        });
      }
    }
    const expFrom =
      typeof q["expiryperiodFrom"] === "string" ? q["expiryperiodFrom"].trim() : "";
    const expTo =
      typeof q["expiryperiodTo"] === "string" ? q["expiryperiodTo"].trim() : "";
    if (expFrom && expTo) {
      const fromT = new Date(`${expFrom}T00:00:00.000Z`).getTime();
      const toT = new Date(`${expTo}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000;
      if (!Number.isNaN(fromT) && !Number.isNaN(toT)) {
        subs = subs.filter((s) => {
          const end = endDateOf(s);
          return end !== null && end.getTime() >= fromT && end.getTime() < toT;
        });
      }
    }

    // 4. Newest first, then paginate.
    subs.sort((a, b) => {
      const ta = new Date(String(a["createAt"] ?? 0)).getTime() || 0;
      const tb = new Date(String(b["createAt"] ?? 0)).getTime() || 0;
      return tb - ta;
    });
    const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
    const limit = Math.max(1, parseInt(String(q["limit"] ?? "20"), 10) || 20);
    const count = subs.length;
    const totalPages = Math.max(1, Math.ceil(count / limit));
    const data = subs.slice((page - 1) * limit, page * limit);

    res.status(200).json({ data, count, totalPages, currentPage: page });
  } catch (err) {
    req.log.error({ err }, "Current-subscriptions composition failed");
    res.status(502).json({ message: "Failed to load current subscriptions from the POS API" });
  }
});

router.post("/subscriptions", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/subscriptions/", body: req.body });
});

router.get("/subscriptions/summary", async (req, res) => {
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/subscriptions/summary/stats",
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    // Upstream returns { success, data: { today, ..., allTime } }; unwrap to the
    // SubscriptionSummary shape the client expects.
    const payload = result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)["data"] ?? result.data
      : result.data;
    res.status(200).json(payload);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch subscription summary");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.get("/subscriptions/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/subscriptions/${req.params.id}` });
});

router.delete("/subscriptions/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/subscriptions/${req.params.id}` });
});

router.put("/subscriptions/:id/extend", async (req, res) => {
  await proxy(req, res, {
    method: "PUT",
    path: `/subscriptions/extend/${req.params.id}`,
    body: req.body,
  });
});

router.put("/subscriptions/:id/verify", async (req, res) => {
  await proxy(req, res, {
    method: "PUT",
    path: `/subscriptions/verify/${req.params.id}`,
    body: req.body,
  });
});

export default router;
