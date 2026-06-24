import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom } from "../lib/upstream";

const router: IRouter = Router();

router.get("/subscriptions", async (req, res) => {
  await proxyList(req, res, { path: "/subscriptions/", query: req.query as Record<string, unknown> });
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
