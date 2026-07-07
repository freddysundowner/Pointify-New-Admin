const express = require("express");
const router = express.Router();
const {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
} = require("../controllers/leads");

// Optional gate: when LEADS_PROXY_SECRET is set in this server's environment,
// only accept requests carrying the matching `x-proxy-secret` header — i.e. only
// the Pointify admin proxy (which derives the affiliate id from a verified
// partner session) can reach these endpoints. This stops a direct caller from
// forging an `affiliate` id to read/modify another partner's leads. If the env
// var is unset, the gate is a no-op and behaves like the rest of the API.
router.use((req, res, next) => {
  const secret = process.env.LEADS_PROXY_SECRET;
  if (!secret) return next();
  if (req.headers["x-proxy-secret"] === secret) return next();
  return res.status(403).json({ status: false, message: "Forbidden" });
});

router.post("/", createLead);
router.get("/", getLeads);
router.get("/:id", getLeadById);
router.put("/:id", updateLead);
router.delete("/:id", deleteLead);

module.exports = router;
