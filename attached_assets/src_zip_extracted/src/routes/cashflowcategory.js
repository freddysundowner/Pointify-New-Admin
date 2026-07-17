const express = require("express");
const router = express.Router();
const { deleteBank, getBankTransations } = require("../controllers/cashflow");
const expenseCategoryController = require("../controllers/cashflowCategory"); // Replace with the actual path
/**
 * @swagger
 * /cashflowcategory:
 *   post:
 *     summary: Create a new cashflow category
 *     tags:
 *       - CashFlow Categories
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the cashflow category
 *                 example: "Food"
 *               type:
 *                 type: string
 *                 enum: [cashin, cashout]
 *               shopId:
 *                 type: string
 *                 description: ID of the shop to associate with the cashflow category
 *                 example: "1234567890"
 *             required:
 *               - name
 *               - shopId
 *     responses:
 *       201:
 *         description: New cashflow category created successfully
 *         content:
 *           application/json:
 *             example:
 *               _id: "1234567890"
 *               name: "Food"
 *               shopId: "1234567890"
 *       400:
 *         description: Bad request, validation failed
 */
router.post("/", expenseCategoryController.createCashflowCategory);

/**
 * @swagger
 * /cashflowcategory/shop/{id}/{type}:
 *   get:
 *     summary: Get all CashFlow Categories
 *     tags:
 *       - CashFlow Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the shop
 *         required: true
 *       - name: type
 *         in: path
 *         description: type of he category
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns a list of all CashFlow Categories
 *         content:
 *           application/json:
 *             example:
 *               - _id: "1234567890"
 *                 name: "Food"
 *                 shopId: "1234567890"
 *               - _id: "9876543210"
 *                 name: "Transportation"
 *                 shopId: "1234567890"
 *       500:
 *         description: Internal server error
 */
router.get("/shop/:id/:type", expenseCategoryController.getCashflowCategories);

/**
 * @swagger
 * /cashflowcategory/{id}:
 *   get:
 *     summary: Get a specific cashflow category by ID
 *     tags:
 *       - CashFlow Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the cashflow category to retrieve
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the requested cashflow category
 *         content:
 *           application/json:
 *             example:
 *               _id: "1234567890"
 *               name: "Food"
 *               shopId: "1234567890"
 *       404:
 *         description: Cashflow category not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", expenseCategoryController.getExpenseCategoryById);

/**
 * @swagger
 * /cashflowcategory/{id}:
 *   put:
 *     summary: Update an cashflow category by ID
 *     tags:
 *       - CashFlow Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the cashflow category to update
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated name of the cashflow category
 *                 example: "Groceries"
 *     responses:
 *       200:
 *         description: Updated cashflow category
 *         content:
 *           application/json:
 *             example:
 *               _id: "1234567890"
 *               name: "Groceries"
 *               shopId: "1234567890"
 *       404:
 *         description: Cashflow category not found
 *       400:
 *         description: Bad request, validation failed
 *       500:
 *         description: Internal server error
 */
router.put("/:id", expenseCategoryController.updateExpenseCategory);

/**
 * @swagger
 * /cashflowcategory/{id}:
 *   delete:
 *     summary: Delete an cashflow category by ID
 *     tags:
 *       - CashFlow Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the cashflow category to delete
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted cashflow category
 *         content:
 *           application/json:
 *             example:
 *               _id: "1234567890"
 *               name: "Groceries"
 *               shopId: "1234567890"
 *       404:
 *         description: Cashflow category not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", expenseCategoryController.deleteExpenseCategory);

module.exports = router;
