import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";

const router: IRouter = Router();

router.post("/payments/withdraw", async (req, res) => {
  await proxy(req, res, {
    method: "POST",
    path: "/payments/mpesa/withdraw",
    body: req.body,
  });
});

export default router;
