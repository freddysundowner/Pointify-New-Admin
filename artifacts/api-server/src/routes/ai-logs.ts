import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

// Stats must be registered before the list so "/ai-logs/stats" is matched
// as its own endpoint rather than being treated as a list query.
router.get("/ai-logs/stats", async (req, res) => {
  await proxy(req, res, {
    method: "GET",
    path: "/ai-logs/stats",
    query: req.query as Record<string, unknown>,
  });
});

router.get("/ai-logs", async (req, res) => {
  await proxyList(req, res, {
    path: "/ai-logs",
    query: req.query as Record<string, unknown>,
  });
});

export default router;
