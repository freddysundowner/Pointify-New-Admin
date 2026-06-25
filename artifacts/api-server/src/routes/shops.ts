import { Router, type IRouter } from "express";
import { proxy, upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

// Upstream getAllShops sorts by `createdAt`, but the Shop model field is
// `createAt` (no "d"), so the sort is a no-op and Mongo returns natural order.
// Since upstream applies skip/limit AFTER that broken sort, correct
// newest-first ordering can only be produced by fetching the full matching set
// and paginating here. `createAt` is an ISO date string; fall back to the
// ObjectId (which is time-ordered) when it is missing.
const SHOP_FETCH_ALL_LIMIT = 1_000_000;

function shopSortKey(shop: unknown): string {
  const o = (shop ?? {}) as Record<string, unknown>;
  const createAt = o["createAt"];
  if (typeof createAt === "string" && createAt) {
    const t = Date.parse(createAt);
    if (!Number.isNaN(t)) return `1:${String(t).padStart(16, "0")}`;
  }
  const id = o["_id"];
  if (typeof id === "string" && id) return `0:${id}`;
  return "0:";
}

// Shop categories
router.get("/shop-categories", async (req, res) => {
  // Upstream `/shop/category` returns a bare array when no `page` is sent; we
  // forward it as-is (categories are a small global list, no pagination needed)
  // so the response matches the spec's `ShopCategory[]` shape.
  await proxy(req, res, { method: "GET", path: "/shop/category" });
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

// Shops — paginated newest-first (sort is done here; see note above).
router.get("/shops", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, Number(q["page"]) || 1);
  const limit = Math.max(1, Number(q["limit"]) || 20);

  // Forward only the upstream-supported filter params; fetch the full set.
  const upstreamQuery: Record<string, unknown> = {
    page: 1,
    limit: SHOP_FETCH_ALL_LIMIT,
  };
  for (const key of ["name", "subscriptionStatus", "subscriptionType", "ownerid", "affliate"]) {
    const v = q[key];
    if (v !== undefined && v !== null && v !== "") upstreamQuery[key] = v;
  }

  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/shop/",
      query: upstreamQuery,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }

    const { data } = normalizeList(result.data);
    const sorted = [...data].sort((a, b) => shopSortKey(b).localeCompare(shopSortKey(a)));

    const count = sorted.length;
    const totalPages = Math.max(1, Math.ceil(count / limit));
    const start = (page - 1) * limit;
    const pageData = sorted.slice(start, start + limit);

    res.status(200).json({ data: pageData, count, totalPages, currentPage: page });
  } catch (err) {
    req.log.error({ err, path: "/shop/" }, "Upstream shops request failed");
    res.status(502).json({ message: "Upstream request failed" });
  }
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
