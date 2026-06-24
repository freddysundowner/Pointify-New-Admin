import { Router, type IRouter } from "express";
import { proxy, proxyList } from "../lib/upstream";

const router: IRouter = Router();

router.get("/attendants", async (req, res) => {
  await proxyList(req, res, {
    path: "/attendants/shop/filter",
    query: req.query as Record<string, unknown>,
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

router.delete("/attendants/:id", async (req, res) => {
  await proxy(req, res, { method: "DELETE", path: `/attendants/${req.params.id}` });
});

export default router;
