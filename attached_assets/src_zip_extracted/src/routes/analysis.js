// routes/stockValueRoute.js

const express = require("express");
const router = express.Router();

const analysisController = require("../controllers/analysis");
const { getSalesSummary } = require("../controllers/sales");
const { salesReport } = require("../controllers/analysis");
const { getPurchasesSummary } = require("../controllers/purchase");


router.get("/stockanalysis", analysisController.calculateStockValue);
router.get("/profits/summary", analysisController.profitSummary);
router.get("/netprofit", analysisController.calculateetProfit);

router.get(
  "/netprofit/yearly/:year",
  analysisController.calculateFinancialDataByYear
);


router.get("/report/sales", getSalesSummary);
router.get("/sales/report", salesReport);



router.get("/report/purchases", getPurchasesSummary);


router.get("/backup/download/:id", analysisController.sendBackupEmail);

 

router.put("/update/user/lastseen", analysisController.updateLastSeen);
router.get("/pdf/download/file", analysisController.getOutOfStockProductsExcel)
router.get("/stock/count/analysis", analysisController.getStockCountAnalysis)
module.exports = router;
 