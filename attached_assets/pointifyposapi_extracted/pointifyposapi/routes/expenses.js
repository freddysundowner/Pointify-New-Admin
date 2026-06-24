const express = require("express");
const router = express.Router();
const {
  createExpense,
  getExpenses,
  getExpensesById,
  updateExpense,
  deleteExpenseflow,
  getExpenseStats,
  getTotalExpenseByCategory,
  getExpensesCategoryTransations,
} = require("../controllers/expenses");
/**
 * @swagger
 * /expenses:
 *   post:
 *     summary: Create a new expenses
 *     tags: [Expenses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the expenses.
 *               amount:
 *                 type: number
 *                 description: The amount of the expenses.
 *               category:
 *                 type: string
 *                 description: The ID of the expenses category.
 *               attendantId:
 *                 type: string
 *                 description: The ID of the attendant.
 *               shopId:
 *                 type: string
 *                 description: The ID of the shop.
 *             required:
 *               - name
 *               - amount
 *               - category
 *               - attendantId
 *               - shopId
 *     responses:
 *       '201':
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cashflow'
 *       '500':
 *         description: Failed to create expenses
 */
router.post("/", createExpense);

/**
 * @swagger
 * /expenses:
 *   get:
 *     summary: Get a list of expenses with filtering options
 *     tags: [Expenses]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: ID of the expenses category to filter by.
 *       - in: query
 *         name: shop
 *         schema:
 *           type: string
 *         description: ID of the shop to filter by.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         format: date
 *         description: Start date for filtering expenses
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         format: date
 *         description: End date for filtering expenses
 *     responses:
 *       '200':
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cashflow'
 *       '500':
 *         description: Failed to retrieve expenses
 */
router.get("/", getExpenses);
router.get("/stats/:id", getExpenses);
/**
 * @swagger
 * /expenses/transactions/{categoryid}:
 *   get:
 *     summary: Get expenses by Shop ID
 *     tags: [Expenses]
 *     parameters:
 *       - in: path
 *         name: categoryid
 *         required: true
 *         description: ID of the expenses
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cashflow'
 *       '404':
 *         description: Cashflow not found
 *       '500':
 *         description: Failed to retrieve expenses
 */
router.get("/transactions/:categoryid", getExpensesCategoryTransations);

/**
 * @swagger
 * /expenses/{id}:
 *   get:
 *     summary: Get a single expenses by ID
 *     tags: [Expenses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the expenses
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cashflow'
 *       '404':
 *         description: Cashflow not found
 *       '500':
 *         description: Failed to retrieve expenses
 */
router.get("/:id", getExpensesById);

/**
 * @swagger
 * /expenses/{id}:
 *   put:
 *     summary: Update an expenses by ID
 *     tags: [Expenses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the expenses
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Cashflow'
 *     responses:
 *       '200':
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cashflow'
 *       '404':
 *         description: Cashflow not found
 *       '500':
 *         description: Failed to update expenses
 */
router.put("/:id", updateExpense);

/**
 * @swagger
 * /expenses/{id}:
 *   delete:
 *     summary: Delete an expenses by ID
 *     tags: [Expenses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the expenses
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Cashflow deleted successfully
 *       '404':
 *         description: Cashflow not found
 *       '500':
 *         description: Failed to delete expenses
 */
router.delete("/:id", deleteExpenseflow);
/**
 * @swagger
 * /expenses/total/category:
 *   get:
 *     summary: Get the totals for all  categories in a specific shop
 *     tags: [Expenses]
 *     parameters:
 *       - in: query
 *         name: shopId
 *         required: true
 *         description: shop id
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         description: startDate
 *         schema:
 *           type: Date
 *       - in: query
 *         name: endDate
 *         description: endDate
 *         schema:
 *           type: Date
 *       - in: query
 *         name: type
 *         description: type
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
 *                   description: The total expenses for the category.
 *       '404':
 *         description: Category not found or has no expenses
 *       '500':
 *         description: Failed to calculate total expenses for the category
 */
router.get("/total/category", getTotalExpenseByCategory);
router.get("/stats/summary/analysis", getExpenseStats);

module.exports = router;
