import { Router, type IRouter } from "express";
import { proxy, upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

// Comprehensive platform statistics. The aggregation runs upstream (it needs
// direct DB access); this proxy simply forwards to the upstream admin analytics
// endpoint, which returns the full StatisticsResult shape in a single call.
router.get("/statistics", (req, res) => proxy(req, res, { method: "GET", path: "/admin/analytics" }));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Revenue for an arbitrary date range. Upstream exposes only fixed buckets
// (today/thisWeek/thisMonth/...), so we mirror its revenue definition here:
// getSubscriptionSummary sums `amount` over subscriptions whose `createAt`
// falls in the range (no `paid` filter), using UTC day boundaries. We fetch the
// full subscriptions list (upstream returns the whole array when no `page` query
// is sent) and sum the matching amounts. Day boundaries are computed in UTC to
// stay consistent with the upstream summary buckets; `to` is inclusive.
router.get("/statistics/revenue", async (req, res) => {
  const authHeader = authHeaderFrom(req);
  if (!authHeader || !/^Bearer\s+\S+$/.test(authHeader)) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    res.status(400).json({ message: "from and to must be dates in YYYY-MM-DD format" });
    return;
  }

  const start = new Date(`${from}T00:00:00.000Z`);
  const endExclusive = new Date(`${to}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1); // include the entire `to` day

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    res.status(400).json({ message: "from and to must be valid dates" });
    return;
  }
  if (start.getTime() >= endExclusive.getTime()) {
    res.status(400).json({ message: "from must be on or before to" });
    return;
  }

  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/subscriptions/",
      authHeader,
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }

    const list = Array.isArray(result.data)
      ? (result.data as unknown[])
      : normalizeList(result.data).data;

    const startMs = start.getTime();
    const endMs = endExclusive.getTime();
    let amount = 0;
    let count = 0;

    for (const item of list) {
      const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const created = o.createAt ?? o.createdAt;
      if (created == null) continue;
      const t = new Date(String(created)).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= startMs && t < endMs) {
        amount += toNumber(o.amount);
        count += 1;
      }
    }

    res.status(200).json({ from, to, currency: "KES", amount, count });
  } catch (err) {
    req.log.error({ err }, "Failed to compute revenue for date range");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

export default router;
