const express = require("express");
const router = express.Router();

const salesExcelReport = require("../controllers/reports/salesExcelReport");

router.post(
    "/sales/excel",
    salesExcelReport
);

module.exports = router;