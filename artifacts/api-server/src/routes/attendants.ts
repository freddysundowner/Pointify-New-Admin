import { Router, type IRouter } from "express";
import { proxy, upstreamFetch, authHeaderFrom, normalizeList } from "../lib/upstream";

const router: IRouter = Router();

// Never expose the upstream password hash in list responses.
function sanitizeAttendant(attendant: unknown): unknown {
  if (attendant && typeof attendant === "object") {
    const { password: _password, ...rest } = attendant as Record<string, unknown>;
    return rest;
  }
  return attendant;
}

router.get("/attendants", async (req, res) => {
  // Upstream `/attendants/all/:id` paginates (nesting paging under a
  // `pagination` object) and supports a `username` regex search; the `:id` is
  // an admin filter where the sentinel "admin" means "no admin filter" (show
  // all). adminId is sent as the path segment, the rest (page, limit,
  // username, shopId) as query params.
  const { adminId, ...rest } = req.query as Record<string, unknown>;
  const id =
    typeof adminId === "string" && adminId.trim().length > 0
      ? adminId.trim()
      : "admin";
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: `/attendants/all/${encodeURIComponent(id)}`,
      query: rest,
      authHeader: authHeaderFrom(req),
    });
    if (result.status >= 400) {
      res.status(result.status).json(result.data);
      return;
    }
    const norm = normalizeList(result.data);
    res.status(200).json({
      data: norm.data.map(sanitizeAttendant),
      count: norm.count,
      totalPages: norm.totalPages,
      currentPage: norm.currentPage,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list attendants");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.post("/attendants", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/attendants/", body: req.body });
});

router.get("/attendants/:id", async (req, res) => {
  try {
    const result = await upstreamFetch({
      method: "GET",
      path: `/attendants/${req.params.id}`,
      authHeader: authHeaderFrom(req),
    });
    res
      .status(result.status)
      .json(result.status >= 400 ? result.data : sanitizeAttendant(result.data));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch attendant");
    res.status(502).json({ message: "Upstream request failed" });
  }
});

router.put("/attendants/:id", async (req, res) => {
  await proxy(req, res, { method: "PUT", path: `/attendants/${req.params.id}`, body: req.body });
});

// Reset an attendant's password. The upstream hashes the supplied password and
// SMSs the plaintext value to the attendant. It reads the id from the body, and
// uses `phone` only as a fallback when the attendant has no number on file.
router.post("/attendants/:id/reset-password", async (req, res) => {
  const { password, phone } = req.body ?? {};
  await proxy(req, res, {
    method: "PUT",
    path: `/attendants/reset/password/sms/${req.params.id}`,
    body: { id: req.params.id, password, phone },
  });
});

router.delete("/attendants/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/attendants/${req.params.id}` });
});

export default router;
