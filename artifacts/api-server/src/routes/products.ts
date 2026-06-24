import { Router, type IRouter, type Request, type Response } from "express";
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

// Product history. `productId`, `month`, and `year` are required query params.
// (The product id is passed as a query param rather than a path segment so the
// generated zod/type names don't collide.) Returns the parsed productId plus the
// remaining query (month/year/pagination) to forward, or null after sending a
// 400 when a required param is missing.
function parseHistoryQuery(
  req: Request,
  res: Response,
): { productId: string; rest: Record<string, unknown> } | null {
  const { productId, ...rest } = (req.query ?? {}) as Record<string, unknown>;
  if (!productId || rest.month == null || rest.year == null) {
    res
      .status(400)
      .json({ message: "productId, month and year are required" });
    return null;
  }
  return { productId: String(productId), rest };
}

router.get("/products/history/stock", async (req, res) => {
  const parsed = parseHistoryQuery(req, res);
  if (!parsed) return;
  await proxyList(req, res, {
    path: `/history/product/stock/${parsed.productId}`,
    query: parsed.rest,
  });
});

router.get("/products/history/sales", async (req, res) => {
  const parsed = parseHistoryQuery(req, res);
  if (!parsed) return;
  await proxyList(req, res, {
    path: `/history/product/sales/${parsed.productId}`,
    query: parsed.rest,
  });
});

router.get("/products/history/purchases", async (req, res) => {
  const parsed = parseHistoryQuery(req, res);
  if (!parsed) return;
  await proxyList(req, res, {
    path: `/history/product/purchases/${parsed.productId}`,
    query: parsed.rest,
  });
});

router.get("/products/history/summary", async (req, res) => {
  const parsed = parseHistoryQuery(req, res);
  if (!parsed) return;
  await proxy(req, res, {
    method: "GET",
    path: `/history/product/summary/${parsed.productId}`,
    query: parsed.rest,
  });
});

router.put("/products/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/product/${req.params.id}`, body: req.body });
});

router.delete("/products/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/product/${req.params.id}` });
});

export default router;
