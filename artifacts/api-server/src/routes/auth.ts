import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";

const router: IRouter = Router();

// Operator login for the super-admin panel authenticates against the upstream
// Staff collection (POST /staff), not the Admin (shop-owner) collection.
router.post("/auth/login", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/staff", body: req.body });
});

export default router;
