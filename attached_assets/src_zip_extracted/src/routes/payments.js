const express = require("express");
const router = express.Router();
const paymentsController = require("../controllers/payments");
router.post("/recordPurchasePayment", paymentsController.recordPurchasePayment);
router.post("/recordSalePayment", paymentsController.recordSalePayment);
router.get("/", paymentsController.getPaymentsByPurchaseIdOrSaleId);
router.delete("/:id", paymentsController.deleteReceipt);
router.get("/awards", paymentsController.getAwardsPayments);
router.post("/awards/withdraw/:id", paymentsController.withdrawAmount)
router.post("/mpesa/withdraw", paymentsController.withdrawAmountMpesa)
router.post("/withdraw/response/", paymentsController.withdrawResponse)
router.get("/transactions", paymentsController.transactions)
router.post("/transactions/b2c", paymentsController.b2c)
router.post("/que/timeout", (req, res) => {
    console.log(req.body,req.query)
})
router.post("/b2b/response", (req, res) => {
    console.log(req.body,req.query)
})

router.post("/elimu/withdraw", paymentsController.withdrawElimu)

router.get("/checkpaymentstatus", paymentsController.checkpaymentstatus)
module.exports = router;
