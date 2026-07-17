const express = require("express");
const router = express.Router();
const smsController = require("../controllers/sms");
router.post("/topup", smsController.topup);
router.get("/sms-logs", smsController.getSmsLogs);
module.exports = router;