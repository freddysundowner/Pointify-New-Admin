import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

// Upstream `GET /packages/` only includes the `trial` package when the supplied
// `id` belongs to a user who has a production subscription (its `getAllPackages`
// excludes `type: 'trial'` otherwise). For the operator-facing catalog we always
// want every package (including the trial) visible, so we inject a reference
// user id known to carry a production subscription. Override with
// POS_PACKAGES_REF_USER_ID if that user ever changes. A client-supplied `id`
// still takes precedence.
const PACKAGES_REF_USER_ID =
  process.env.POS_PACKAGES_REF_USER_ID || "6597cf1b9611b3e649ace43f";

router.get("/packages", async (req, res) => {
  const query = { ...(req.query as Record<string, unknown>) };
  if (query.id == null || query.id === "") {
    query.id = PACKAGES_REF_USER_ID;
  }
  await proxyList(req, res, { path: "/packages/", query });
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
