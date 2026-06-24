import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/admins", async (req, res) => {
  await proxyList(req, res, { path: "/admin/", query: req.query as Record<string, unknown> });
});

router.get("/admins/by-subscription", async (req, res) => {
  await proxyList(req, res, {
    path: "/admin/users/subscriptions",
    query: req.query as Record<string, unknown>,
  });
});

router.get("/admins/:id", async (req, res) => {
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/admin/",
      query: { page: 1, limit: 2000 },
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const list = normalizeList(result.data).data as Array<Record<string, unknown>>;
    const found = list.find((a) => String(a["_id"]) === req.params.id);
    if (!found) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }
    res.status(200).json(found);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin by id");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.put("/admins/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/admin/${req.params.id}`, body: req.body });
});

router.delete("/admins/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/admin/${req.params.id}` });
});

router.post("/admins/:id/reset-password", async (req, res) => {
  const password = (req.body as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "A password of at least 4 characters is required" });
    return;
  }
  await proxy(req, res, {
    method: "POST",
    path: "/auth/reset/password/sms",
    body: { id: req.params.id, password },
  });
});

export default router;
