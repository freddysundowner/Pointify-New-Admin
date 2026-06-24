const express = require("express");
const router = express.Router();
const {
  createCashflowBank,
  getBanksList,
  deleteBank,
  getBankTransations,
  updateBank,
} = require("../controllers/bank");
/**
 * @swagger
 * /bank/list/{shop}:
 *   get:
 *     summary: Get list of banks in a specific shop
 *     tags: [Bank]
 *     parameters:
 *       - in: path
 *         name: shop
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
router.get("/list/:shop", getBanksList);

/**
 * @swagger
 * /bank:
 *   post:
 *     summary: Create a new cashflow
 *     tags: [Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the cashflow.
 *               shop:
 *                 type: string
 *                 description: The ID of the shop.
 *               amount:
 *                 type: string
 *                 description: The amount banked.
 *             required:
 *               - name
 *               - shop
 *               - amount
 *     responses:
 *       '201':
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cashflow'
 *       '500':
 *         description: Failed to create cashflow
 */
router.post("", createCashflowBank);

/**
 * @swagger
 * /bank/{id}:
 *   delete:
 *     summary: Delete an cashflow category by ID
 *     tags: [Bank]
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the bank category to delete
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
router.delete("/:id", deleteBank);
/**
 * @swagger
 * /bank/transactions/{bankid}:
 *   get:
 *     summary: Get bank transactions by bank id
 *     tags: [Bank]
 *     parameters:
 *       - name: bank
 *         in: path
 *         description: Get bank transactions by bank id
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
router.get("/transactions/:bankid", getBankTransations);

/**
 * @swagger
 * /bank/{id}:
 *   put:
 *     summary: Update an cashflow by ID
 *     tags: [Bank]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the cashflow
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
 *         description: Failed to update cashflow
 */
router.put("/:id", updateBank);
module.exports = router;