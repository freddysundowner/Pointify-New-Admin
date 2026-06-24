import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/packages", async (req, res) => {
  await proxyList(req, res, { path: "/packages/", query: req.query as Record<string, unknown> });
});

// Packages priced for a specific user (reflects old/new pricing group).
// Must precede /packages/:id so "for-user" is not treated as an id.
router.get("/packages/for-user", async (req, res) => {
  await proxyList(req, res, { path: "/packages/", query: { id: req.query.id } });
});

router.post("/packages", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/packages/", body: req.body });
});

router.get("/packages/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/packages/${req.params.id}` });
});

router.put("/packages/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/packages/${req.params.id}`, body: req.body });
});

router.delete("/packages/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/packages/${req.params.id}` });
});

export default router;
