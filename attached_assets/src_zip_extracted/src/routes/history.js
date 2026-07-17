const express = require("express");
const router = express.Router();
const history = require("../controllers/history");
router.get("/product/sales/:id", history.getProductSalesHistory);
router.get("/product/purchases/:id", history.getProductPurchasesHistory);
router.get("/product/stock/:id", history.getProductStockHistory);
router.get("/product/summary/:id", history.getProductSummary);
module.exports = router;

