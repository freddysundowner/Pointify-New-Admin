// routes/purchase.js

const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase");

router.post("/", purchaseController.createPurchaseWithItems);
router.get("/", purchaseController.getAllPurchases);
router.get("/:purchaseId", purchaseController.getPurchaseById);
router.put("/:id", purchaseController.updatePurchase);
router.delete("/:id", purchaseController.deletePurchase);
router.get(
  "/product/filter",
  purchaseController.getProductPurchasesReceiptItems
);

router.get("/product/month/analysis", purchaseController.groupPurchasesByMonth);
router.get("/send/report/email", purchaseController.sendreportemail);
module.exports = router;
