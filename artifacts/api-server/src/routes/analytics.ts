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
      upstreamFetch({ method: "GET", path: "/shop/stats/metrics", authHeader }),
      upstreamFetch({ method: "GET", path: "/admin/", query: { page: 1, limit: 1 }, authHeader }),
    ]);

    const revenue = asRecord(asRecord(summaryRes.data)["data"]);
    const shopStats = asRecord(asRecord(shopStatsRes.data)["data"]);
    const totalUsers = normalizeList(adminsRes.data).count;

    const productionActive = num(shopStats["productionActive"]);
    const productionExpired = num(shopStats["productionExpired"]);
    const trialActive = num(shopStats["trialActive"]);
    const trialExpired = num(shopStats["trialExpired"]);

    const activeShops = productionActive + trialActive;
    const expiredShops = productionExpired + trialExpired;
    const trialShops = trialActive + trialExpired;

    res.status(200).json({
      revenue,
      shops: {
        totalShops: num(shopStats["totalShops"]),
        productionActive,
        productionExpired,
        trialActive,
        trialExpired,
        payingShops: productionActive,
        activeShops,
        expiredShops,
        trialShops,
        shopsThisMonth: num(shopStats["shopsThisMonth"]),
        shopsLastMonth: num(shopStats["shopsLastMonth"]),
        growthRate: num(shopStats["growthRate"]),
      },
      totalUsers,
      payingUsers: productionActive,
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
