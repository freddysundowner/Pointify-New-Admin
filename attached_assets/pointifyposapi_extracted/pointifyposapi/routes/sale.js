// routes/purchase.js

const express = require("express");
const router = express.Router();
const saleController = require("../controllers/sales");
router.put("/void/sale/:id", saleController.voidSale);

router.put("/:id", saleController.updateSale);

router.post("/", saleController.createSale);

router.get("/product/filter", saleController.getproductSales);

router.get("/filter", saleController.getSales);


router.get(
  "/summary/bydates",
  saleController.calculateTotalSalesAndProfitByDates
);


router.get("/shops/sales", saleController.getShopSales)


router.get("/product/month/analysis", saleController.groupSalesByMonth);


router.get(
  "/summary/month/analysis/product",
  saleController.getMostSellingProducts
);


router.get("/single/receipt/:id", saleController.getSingleSale);
router.get("/sandbox/updating/sales/:id", saleController.updateSaleSandbox);
router.get("/products/reports", saleController.productsSalesReports);
router.get("/discount/reports", saleController.salesDiscountReports);
router.get("/reports/statements", saleController.statementRequests);
router.get("/send/report/email", saleController.sendreportemail);
router.post("/orders/sale/online", saleController.onlineSale);
router.get("/orders/sale/online", saleController.getonlineSale);
router.delete("/orders/sale/online/:id", saleController.deleteonlineSale);
module.exports = router;
