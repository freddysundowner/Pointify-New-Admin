import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/sales", async (req, res) => {
  await proxyList(req, res, { path: "/sales/filter", query: req.query as Record<string, unknown> });
});

router.get("/sales/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/sales/single/receipt/${req.params.id}` });
});

export default router;
