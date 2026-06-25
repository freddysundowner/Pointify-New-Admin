import { Router, type IRouter } from "express";
import { proxy } from "../lib/upstream";
import { normalizeKenyanMsisdn } from "../lib/phone";

const router: IRouter = Router();

router.post("/payments/withdraw", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  // Safaricom B2C rejects local phone formats (e.g. 07XXXXXXXX) with a 400
  // "Invalid PartyB", and the upstream forwards the number unchanged — so
  // normalize to MSISDN (2547XXXXXXXX) here before proxying.
  const phone = normalizeKenyanMsisdn(String(body["phonenumber"] ?? ""));
  if (!phone) {
    res.status(400).json({
      message: "Enter a valid Kenyan M-Pesa number, e.g. 0712345678.",
    });
    return;
  }
  await proxy(req, res, {
    method: "POST",
    path: "/payments/mpesa/withdraw",
    body: { ...body, phonenumber: phone },
  });
});

export default router;
