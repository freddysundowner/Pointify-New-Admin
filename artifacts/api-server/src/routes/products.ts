import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

// Product categories
router.get("/product-categories", async (req, res) => {
  await proxyList(req, res, { path: "/product/category/", query: req.query as Record<string, unknown> });
});

router.post("/product-categories", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/product/category/", body: req.body });
});

router.put("/product-categories/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/product/category/${req.params.id}`, body: req.body });
});

router.delete("/product-categories/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/product/category/${req.params.id}` });
});

// Products. Use the admin list endpoint which supports searching by product
// name (`name`), shop name (`shop`), and exact shop id (`shopid`).
router.get("/products", async (req, res) => {
  await proxyList(req, res, {
    path: "/product/admin/products",
    query: req.query as Record<string, unknown>,
  });
});

router.post("/products", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/product/", body: req.body });
});

router.get("/products/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/product/${req.params.id}` });
});

router.put("/products/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/product/${req.params.id}`, body: req.body });
});

router.delete("/products/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/product/${req.params.id}` });
});

export default router;
