const express = require("express");
const router = express.Router();
const printerController = require("../controllers/printerController");

router.get("/status", printerController.getPrinterStatus);
router.post("/initialize", printerController.initializePrinter);
router.post("/test", printerController.testPrint);
router.post("/cash-drawer", printerController.openCashDrawer);
router.post("/receipt", printerController.printReceipt);

module.exports = router;
