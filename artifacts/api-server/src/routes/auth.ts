import { Router, type IRouter } from "express";
import { upstreamFetch } from "../lib/upstream";
import { signAdminSession } from "../lib/adminAuth";

const router: IRouter = Router();

// Operator login for the super-admin panel authenticates against the upstream
// Staff collection (POST /staff), not the Admin (shop-owner) collection.
// On success the proxy replaces the upstream JWT with its own signed session
// token (see lib/adminAuth.ts) so proxy-gated endpoints can verify callers.
router.post("/auth/login", async (req, res) => {
  try {
    const result = await upstreamFetch({
      method: "POST",
      path: "/staff",
      body: req.body,
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const body = (result.data ?? {}) as Record<string, unknown>;
    const userdata = (body["userdata"] ?? {}) as Record<string, unknown>;
    const id = typeof userdata["_id"] === "string" ? userdata["_id"] : "";
    const email = typeof userdata["email"] === "string" ? userdata["email"] : "";
    const upstreamToken = typeof body["token"] === "string" ? body["token"] : "";
    if (!id || !email || !upstreamToken) {
      req.log.error({ status: result.status }, "Unexpected upstream login response shape");
      res.status(502).json({ message: "Unexpected response from the POS API" });
      return;
    }
    res.status(200).json({
      ...body,
      token: signAdminSession({ id, email, ut: upstreamToken }),
    });
  } catch (err) {
    req.log.error({ err }, "Login proxy failed");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

export default router;
