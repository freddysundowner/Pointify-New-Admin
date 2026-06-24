import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";

const router: IRouter = Router();

router.get("/settings", async (req, res) => {
  await proxy(req, res, { method: "GET", path: "/settings/" });
});

router.post("/settings", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/settings/", body: req.body });
});

export default router;
