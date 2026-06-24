import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

// Shop categories
router.get("/shop-categories", async (req, res) => {
  await proxyList(req, res, { path: "/shop/category", query: req.query as Record<string, unknown> });
});

router.post("/shop-categories", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/shop/category", body: req.body });
});

router.put("/shop-categories/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/shop/category/${req.params.id}`, body: req.body });
});

router.delete("/shop-categories/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/shop/category/${req.params.id}` });
});

// Shop stats (must precede /shops/:id)
router.get("/shops/stats", async (req, res) => {
  await proxy(req, res, { method: "GET", path: "/shop/stats/metrics", query: req.query as Record<string, unknown> });
});

// Shops
router.get("/shops", async (req, res) => {
  await proxyList(req, res, { path: "/shop/", query: req.query as Record<string, unknown> });
});

router.post("/shops", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/shop/", body: req.body });
});

router.get("/shops/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/shop/${req.params.id}` });
});

router.put("/shops/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/shop/${req.params.id}`, body: req.body });
});

router.delete("/shops/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/shop/${req.params.id}` });
});

export default router;
