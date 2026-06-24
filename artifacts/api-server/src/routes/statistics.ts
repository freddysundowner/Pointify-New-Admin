import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";

const router: IRouter = Router();

// Comprehensive platform statistics. The aggregation runs upstream (it needs
// direct DB access); this proxy simply forwards. See deliverables/statistics.controller.js
// for the upstream method the operator pastes into the Pointify POS API.
router.get("/statistics", (req, res) => proxy(req, res, { method: "GET", path: "/statistics" }));

export default router;
