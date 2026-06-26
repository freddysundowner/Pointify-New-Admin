import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom } from "../lib/upstream";

const router: IRouter = Router();

/**
 * Pull a bare id out of an upstream relation field, which may be either a
 * populated object ({ _id, ... }) or a bare id string.
 */
function relId(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object") {
    const id = (value as Record<string, unknown>)["_id"];
    if (typeof id === "string" && id.length > 0) return id;
  }
  return undefined;
}

async function fetchSale(req: Parameters<typeof authHeaderFrom>[0], id: string) {
  const result = await upstreamFetch({
    method: "GET",
    path: `/sales/single/receipt/${id}`,
    authHeader: authHeaderFrom(req),
  });
  return result;
}

router.get("/sales", async (req, res) => {
  await proxyList(req, res, { path: "/sales/filter", query: req.query as Record<string, unknown> });
});

router.get("/sales/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/sales/single/receipt/${req.params.id}` });
});

/**
 * Change the date/time of a receipt.
 *
 * Upstream `updateSale` only updates plain fields (without recalculating
 * inventory) through the `status === "cashed"` branch. For sales on "hold" that
 * branch instead deducts from the customer wallet, and for other statuses the
 * controller falls through to a full inventory recomputation. To keep this a
 * safe, side-effect-free date edit we only allow it for already-cashed
 * receipts, and we echo the existing "cashed" status back so nothing else
 * changes.
 */
router.put("/sales/:id", async (req, res) => {
  const { id } = req.params;
  const createdAt = (req.body as Record<string, unknown> | undefined)?.["createdAt"];
  if (typeof createdAt !== "string" || createdAt.length === 0) {
    res.status(400).json({ message: "createdAt (ISO date string) is required." });
    return;
  }
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    res.status(400).json({ message: "createdAt must be a valid date." });
    return;
  }

  try {
    const sale = await fetchSale(req, id);
    if (sale.status === 404) {
      res.status(404).json({ message: "Receipt not found." });
      return;
    }
    if (sale.status >= 400) {
      // Forward upstream auth/server errors verbatim instead of masking them
      // behind a local "not cashed" message.
      res.status(sale.status).json(sale.data);
      return;
    }
    if (!sale.data || typeof sale.data !== "object") {
      res.status(404).json({ message: "Receipt not found." });
      return;
    }
    const status = (sale.data as Record<string, unknown>)["status"];
    if (status !== "cashed") {
      res.status(422).json({
        message:
          "Only completed (cashed) receipts can have their date changed. This receipt is '" +
          String(status ?? "unknown") +
          "'.",
      });
      return;
    }
  } catch (err) {
    req.log.error({ err, id }, "Failed to load sale before date edit");
    res.status(502).json({ message: "Upstream request failed" });
    return;
  }

  await proxy(req, res, {
    method: "PUT",
    path: `/sales/${id}`,
    body: { status: "cashed", createdAt: parsed.toISOString() },
  });
});

/**
 * Refund (return) one or more items on a receipt.
 *
 * Upstream `createSaleReturn` needs `shopId` and `attendantId`; we resolve those
 * from the sale itself rather than trusting the client, so the inventory restock
 * and return record are attributed correctly.
 */
router.post("/sales/:id/returns", async (req, res) => {
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const items = body["items"];
  const reason = typeof body["reason"] === "string" ? body["reason"] : undefined;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "At least one item to return is required." });
    return;
  }
  for (const item of items) {
    const product = relId((item as Record<string, unknown>)?.["product"]);
    const quantity = Number((item as Record<string, unknown>)?.["quantity"]);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ message: "Each item needs a product id and a quantity greater than 0." });
      return;
    }
  }

  let shopId: string | undefined;
  let attendantId: string | undefined;
  try {
    const sale = await fetchSale(req, id);
    if (sale.status === 404) {
      res.status(404).json({ message: "Receipt not found." });
      return;
    }
    if (sale.status >= 400) {
      // Forward upstream auth/server errors verbatim instead of masking them.
      res.status(sale.status).json(sale.data);
      return;
    }
    if (!sale.data || typeof sale.data !== "object") {
      res.status(404).json({ message: "Receipt not found." });
      return;
    }
    const data = sale.data as Record<string, unknown>;
    shopId = relId(data["shopId"]);
    attendantId = relId(data["attendantId"]);
    if (!shopId || !attendantId) {
      res.status(422).json({
        message: "This receipt is missing its shop or attendant, so it cannot be refunded.",
      });
      return;
    }
  } catch (err) {
    req.log.error({ err, id }, "Failed to load sale before refund");
    res.status(502).json({ message: "Upstream request failed" });
    return;
  }

  // Aggregate duplicate product lines so crafted payloads with repeated
  // product ids can't distort upstream refund math / stock updates.
  const quantityByProduct = new Map<string, number>();
  for (const item of items as Record<string, unknown>[]) {
    const product = relId(item["product"]);
    if (!product) continue;
    quantityByProduct.set(product, (quantityByProduct.get(product) ?? 0) + Number(item["quantity"]));
  }
  const normalizedItems = [...quantityByProduct].map(([product, quantity]) => ({
    product,
    quantity,
  }));

  await proxy(req, res, {
    method: "POST",
    path: "/salereturns/",
    body: {
      saleid: id,
      shopId,
      attendantId,
      items: normalizedItems,
      ...(reason ? { reason } : {}),
    },
  });
});

export default router;
