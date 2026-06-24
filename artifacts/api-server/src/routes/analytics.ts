import { Router, type IRouter } from "express";
import { upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

router.get("/analytics/overview", async (req, res) => {
  const authHeader = authHeaderFrom(req);
  try {
    const [summaryRes, shopStatsRes, adminsRes] = await Promise.all([
      upstreamFetch({ method: "GET", path: "/subscriptions/summary/stats", authHeader }),
      // Authoritative subscription/shop breakdown: classifies by package.type
      // (trial | production) and treats a shop as active only when its subscription
      // is paid and within its start/end dates. The shop/stats/metrics endpoint is
      // unreliable for trials, so we use this one.
      upstreamFetch({ method: "GET", path: "/subscriptions/shop/stats", authHeader }),
      upstreamFetch({ method: "GET", path: "/admin/", query: { page: 1, limit: 1 }, authHeader }),
    ]);

    const revenue = asRecord(asRecord(summaryRes.data)["data"]);
    const totalUsers = normalizeList(adminsRes.data).count;

    const stats = asRecord(shopStatsRes.data);
    const shopActive = asRecord(asRecord(stats["shops"])["active"]);
    const shopExpired = asRecord(asRecord(stats["shops"])["expired"]);
    const userActive = asRecord(asRecord(stats["users"])["active"]);

    const productionActive = num(shopActive["production"]);
    const productionExpired = num(shopExpired["production"]);
    const trialActive = num(shopActive["trial"]);
    const trialExpired = num(shopExpired["trial"]);

    const activeShops = num(shopActive["total"]) || productionActive + trialActive;
    const expiredShops = num(shopExpired["total"]) || productionExpired + trialExpired;
    const trialShops = trialActive + trialExpired;
    const totalShops = activeShops + expiredShops;

    // Paying customers = shop owners with at least one active production subscription.
    const payingUsers = num(userActive["production"]);

    res.status(200).json({
      revenue,
      shops: {
        totalShops,
        productionActive,
        productionExpired,
        trialActive,
        trialExpired,
        payingShops: productionActive,
        activeShops,
        expiredShops,
        trialShops,
      },
      totalUsers,
      payingUsers,
      activeShops,
      expiredShops,
      trialShops,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compose analytics overview");
    res.status(502).json({ message: "Failed to load analytics" });
  }
});

export default router;
