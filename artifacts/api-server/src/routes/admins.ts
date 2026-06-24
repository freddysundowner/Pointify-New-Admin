import { Router, type IRouter } from "express";
import { proxy, proxyList, upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

// Kenya (EAT) is UTC+3 and the upstream has no DST. Day boundaries for the
// "registered on a specific day" filter are interpreted in EAT so the operator's
// notion of a calendar day matches what they see.
const EAT_OFFSET = "+03:00";

function isValidDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(Date.parse(`${s}T00:00:00.000${EAT_OFFSET}`));
}

function adminCreatedAtMs(admin: Record<string, unknown>): number | null {
  const raw = admin["createdAt"];
  if (typeof raw === "string" || typeof raw === "number") {
    const t = Date.parse(String(raw));
    if (!Number.isNaN(t)) return t;
  }
  // Fallback: derive from the Mongo ObjectId timestamp (first 4 bytes = seconds).
  const id = admin["_id"];
  if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
    return parseInt(id.slice(0, 8), 16) * 1000;
  }
  return null;
}

// Never expose the upstream password hash in list responses.
function sanitizeAdmin(admin: unknown): unknown {
  if (admin && typeof admin === "object") {
    const { password: _password, ...rest } = admin as Record<string, unknown>;
    return rest;
  }
  return admin;
}

router.get("/admins", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const search = (q["search"] ?? q["name"]) as string | undefined;
  const from = (q["from"] as string | undefined)?.trim() || undefined;
  const to = (q["to"] as string | undefined)?.trim() || undefined;
  const page = Math.max(1, parseInt(String(q["page"] ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(q["limit"] ?? "20"), 10) || 20);

  if (from && !isValidDay(from)) {
    res.status(400).json({ message: "Invalid 'from' date; expected YYYY-MM-DD" });
    return;
  }
  if (to && !isValidDay(to)) {
    res.status(400).json({ message: "Invalid 'to' date; expected YYYY-MM-DD" });
    return;
  }
  if (from && to && from > to) {
    res.status(400).json({ message: "'from' date must not be after 'to' date" });
    return;
  }

  // No date filter: let the upstream paginate natively (efficient path).
  if (!from && !to) {
    try {
      const result = await upstreamFetch({
        method: "GET",
        path: "/admin/",
        query: { name: search, page, limit },
        authHeader: authHeaderFrom(req),
      });
      if (result.status >= 400) {
        res.status(result.status).json(result.data);
        return;
      }
      const norm = normalizeList(result.data);
      res.status(200).json({
        data: norm.data.map(sanitizeAdmin),
        count: norm.count,
        totalPages: norm.totalPages,
        currentPage: norm.currentPage,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to list admins");
      res.status(502).json({ message: "Upstream request failed" });
    }
    return;
  }

  // Date filter: upstream has no date support, so fetch the matching set and
  // filter/paginate here in the proxy.
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: "/admin/",
      query: { name: search, page: 1, limit: 100000 },
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const all = normalizeList(result.data).data as Array<Record<string, unknown>>;

    const fromMs = from
      ? Date.parse(`${from}T00:00:00.000${EAT_OFFSET}`)
      : Number.NEGATIVE_INFINITY;
    const toMs = to
      ? Date.parse(`${to}T23:59:59.999${EAT_OFFSET}`)
      : Number.POSITIVE_INFINITY;

    const filtered = all.filter((a) => {
      const ms = adminCreatedAtMs(a);
      if (ms === null) return false;
      return ms >= fromMs && ms <= toMs;
    });

    const count = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit).map(sanitizeAdmin);

    res.status(200).json({
      data,
      count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      currentPage: page,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to filter admins by date");
    res.status(502).json({ message: "Upstream request failed" });
  }
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

router.get("/admins/:id/shops", async (req, res) => {
  await proxyList(req, res, {
    path: `/shop/admin/${req.params.id}`,
    query: req.query as Record<string, unknown>,
  });
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
