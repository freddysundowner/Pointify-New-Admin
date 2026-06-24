import { Router, type IRouter } from "express";
import { proxyList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/purchases", async (req, res) => {
  await proxyList(req, res, { path: "/purchases/", query: req.query as Record<string, unknown> });
});

export default router;
