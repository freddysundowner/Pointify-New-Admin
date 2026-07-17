const express = require("express");
const router = express.Router();
const { getAiLogs, getAiLogStats } = require("../controllers/aiLogsController");
router.get("/stats", getAiLogStats); 
router.get("/", getAiLogs);

module.exports = router;