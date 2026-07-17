const express = require("express");
const router = express.Router();

const returnController = require("../controllers/purchasereturn");
router.post("/", returnController.createPurchaseReturn);
router.get("/:id", returnController.getPurchaseReturn);
router.put("/:id", returnController.updatePurchaseReturn);
router.delete("/:id", returnController.deletePurchaseReturn);
router.get("/", returnController.getPurchaseReturns);

module.exports = router;
