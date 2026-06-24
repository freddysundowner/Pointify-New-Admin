const express = require("express");
const router = express.Router();
const expenseCategoryController = require("../controllers/expenseCategory"); // Replace with the actual path
/**
 * @swagger
 * /expensescategory:
 *   post:
 *     summary: Create a new expsense category
 *     tags:
 *       - Expenses Category
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the expsense category
 *                 example: "Food"
 *               shopId:
 *                 type: string
 *                 description: ID of the shop to associate with the expsense category
 *                 example: "1234567890"
 *             required:
 *               - name
 *               - shopId
 *     responses:
 *       201:
 *         description: New expsense category created successfully
 *         content:
 *           application/json:
 *             example:
 *               _id: "1234567890"
 *               name: "Food"
 *               shopId: "1234567890"
 *       400:
 *         description: Bad request, validation failed
 */
router.post("/", expenseCategoryController.createExpenseCategory);

/**
 * @swagger
 * /expensescategory:
 *   get:
 *     summary: Get all Expenses Category
 *     tags:
 *       - Expenses Category
 *     parameters:
 *       - name: id
 *         in: query
 *         description: ID of the shop
 *         required: true
 *     responses:
 *       200:
 *         description: Returns a list of all Expenses Category
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
router.get("/", expenseCategoryController.getExpensesCategories);

/**
 * @swagger
 * /expensescategory/{id}:
 *   get:
 *     summary: Get a specific expsense category by ID
 *     tags:
 *       - Expenses Category
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the expsense category to retrieve
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the requested expsense category
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
 * /expensescategory/{id}:
 *   put:
 *     summary: Update an expsense category by ID
 *     tags:
 *       - Expenses Category
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the expsense category to update
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
 *                 description: Updated name of the expsense category
 *                 example: "Groceries"
 *     responses:
 *       200:
 *         description: Updated expsense category
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
 * /expensescategory/{id}:
 *   delete:
 *     summary: Delete an expsense category by ID
 *     tags:
 *       - Expenses Category
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the expsense category to delete
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted expsense category
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
