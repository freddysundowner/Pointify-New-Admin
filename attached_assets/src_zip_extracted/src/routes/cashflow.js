const express = require("express");
const router = express.Router();
const {
  createCashflow,
  getCashflow,
  getCashflowById,
  updateCashflow,
  deleteCashflow,
  getCashflowTransations,
  getTotalCashflowByCategory,
  cashFlowManager,
  getCashflowCategoryTransations,
} = require("../controllers/cashflow");
router.post("/", createCashflow);
router.get("/", getCashflow);
router.get("/transactions/:shopId", getCashflowTransations);
router.get("/:id", getCashflowById);
router.put("/:id", updateCashflow);
router.delete("/:id", deleteCashflow);
router.get("/total/category", getTotalCashflowByCategory);

router.delete("/:id", deleteCashflow);
router.get("/shop/cashflow", cashFlowManager);

/**
 * @swagger
 * /cashflow/transactions/category/{categoryid}:
 *   get:
 *     summary: transactions for a specific category
 *     tags: [CashFlow]
 *     parameters:
 *       - in: path
 *         name: categoryid
 *         required: true
 *         description: shop id
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   description: The total cashflow for the category.
 *       '404':
 *         description: Category not found or has no cashflow
 *       '500':
 *         description: Failed to calculate total cashflow for the category
 */
router.get(
  "/transactions/category/:categoryid",
  getCashflowCategoryTransations
);
module.exports = router;
