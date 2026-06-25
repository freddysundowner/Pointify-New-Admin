import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";

const router: IRouter = Router();

// Comprehensive platform statistics. The aggregation runs upstream (it needs
// direct DB access); this proxy simply forwards to the upstream admin analytics
// endpoint, which returns the full StatisticsResult shape in a single call.
router.get("/statistics", (req, res) => proxy(req, res, { method: "GET", path: "/admin/analytics" }));

export default router;
