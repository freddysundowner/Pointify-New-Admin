// routes/badStock.js
const express = require('express');
const router = express.Router();
const badStockController = require('../controllers/badstock');
router.post('/', badStockController.createBadStock);
router.get('/', badStockController.getBadStock);
router.get('/summary', badStockController.getBadStockSummary);
/**
 * @swagger
 * /badstock/product/filter:
 *   get:
 *     summary: Get bad products by date
 *     tags:
 *       - Bad Stock
 *     description: Retrieve bad products that match the provided date.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: The start date of the date range.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *       - in: query
 *         name: shopid
 *         schema:
 *           type: string
 *         required: true
 *         description: The end date of the date range.
 *     responses: 
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               - productId: 1234567890
 *                 shopId: 9876543210
 *                 attendantId: 5678901234
 *                 quantity: 5
 *                 reason: "Damaged goods"
 *                 createdAt: "2023-11-02T14:07:50.768+00:00"
 */
router.get("/product/filter", badStockController.getBadProductsByDate);
router.delete("/:id", badStockController.deleteBadStock)
router.get("/summary/analysis", badStockController.getBadStockSummaries)
module.exports = router;