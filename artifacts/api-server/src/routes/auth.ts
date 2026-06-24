import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/auth/login", body: req.body });
});

export default router;
