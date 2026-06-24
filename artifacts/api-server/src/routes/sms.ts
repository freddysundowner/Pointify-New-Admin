import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/sms/logs", async (req, res) => {
  await proxyList(req, res, { path: "/sms/sms-logs", query: req.query as Record<string, unknown> });
});

router.post("/sms/topup", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/sms/topup", body: req.body });
});

router.post("/sms/bulk", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/communication/bulk/sms", body: req.body });
});

router.get("/communications", async (req, res) => {
  await proxyList(req, res, { path: "/communication/", query: req.query as Record<string, unknown> });
});

export default router;
