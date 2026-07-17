
const express = require("express");
const router = express.Router();
const { getCommunications,sendCommunication,resendCommunication ,sendBulkSmsByUserType} = require("../controllers/communications");

router.post("/", sendCommunication);
router.get("/", getCommunications);
router.post("/:id/resend", resendCommunication);
router.post("/bulk/sms", sendBulkSmsByUserType);

module.exports = router;
