import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/attendants", async (req, res) => {
  // Upstream `/attendants/all/:id` paginates and supports a `username` regex
  // search; the `:id` is an admin filter where the sentinel "admin" means
  // "no admin filter" (show all). adminId is sent as the path segment, the
  // rest (page, limit, username, shopId) as query params.
  const { adminId, ...rest } = req.query as Record<string, unknown>;
  const id =
    typeof adminId === "string" && adminId.trim().length > 0
      ? adminId.trim()
      : "admin";
  await proxyList(req, res, {
    path: `/attendants/all/${encodeURIComponent(id)}`,
    query: rest,
  });
});

router.post("/attendants", async (req, res) => {
  await proxy(req, res, { method: "POST", path: "/attendants/", body: req.body });
});

router.get("/attendants/:id", async (req, res) => {
  await proxy(req, res, { method: "GET", path: `/attendants/${req.params.id}` });
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
