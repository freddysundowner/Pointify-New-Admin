const express = require("express");
const router = express.Router();

const returnController = require("../controllers/salereturn");

/**
 * @swagger
 * /salereturns/:
 *   post:
 *     summary: Create a new sale return entry
 *     tags:
 *       - Sale Returns
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               saleid:
 *                 type: string
 *                 description: The ID of the original sale associated with the return.
 *               shopId:
 *                 type: string
 *                 description: The ID of the shop.
 *               deleteReceipt:
 *                 type: string
 *                 description: The ID of the original sale associated with the return.
 *               attendantId:
 *                 type: string
 *                 description: The ID of the original sale associated with the return.
 *               items:
 *                 type: array
 *                 description: An array of returned items, each containing a product ID and quantity.
 *                 items:
 *                   type: object
 *                   properties:
 *                     product:
 *                       type: string
 *                       description: The ID of the product being returned.
 *                     quantity:
 *                       type: number
 *                       description: The quantity of the product being returned.
 *               reason:
 *                 type: string
 *                 description: An optional reason for the return.
 *     responses:
 *       '201':
 *         description: Successfully created a new sale return entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saleReturn:
 *                   type: object
 *                   description: The newly created sale return entry.
 *                 updatedProducts:
 *                   type: array
 *                   description: An array of updated product quantities.
 *                 updatedsaleItems:
 *                   type: array
 *                   description: An array of updated sale items.
 *       '400':
 *         description: Bad request. Invalid input data.
 *       '404':
 *         description: Product or sale item not found.
 *       '500':
 *         description: Internal server error.
 */

router.post("/", returnController.createSaleReturn);
/**
 * @swagger
 * /salereturns/filter:
 *   get:
 *     summary: Get sale returns with filters
 *     tags:
 *       - Sale Returns
 *     description: Retrieve sale returns with optional filters based on saleId, customerId, attendantId, and productId.
 *     parameters:
 *       - in: query
 *         name: saleId
 *         description: The ID of the sale associated with the return.
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         description: The ID of the customer associated with the return.
 *         schema:
 *           type: string
 *       - in: query
 *         name: attendantId
 *         description: The ID of the attendant associated with the return.
 *         schema:
 *           type: string
 *       - in: query
 *         name: productId
 *         description: The ID of the product associated with the return items.
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         description: Start date for the date range filter (YYYY-MM-DD).
 *         schema:
 *           type: string
 *       - in: query
 *         name: toDate
 *         description: End date for the date range filter (YYYY-MM-DD).
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: An array of sale returns with populated custom name, attendant username, and product name.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SaleReturn'
 *       500:
 *         description: Internal server error.
 */

router.get("/filter", returnController.getSaleReturn);
/**
 * @swagger
 * /{id}:
 *   put:
 *     summary: Update a sale return by ID
 *     tags:
 *       - Sale Returns
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the sale return to update.
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               originalSaleeId:
 *                 type: string
 *                 description: The updated ID of the original sale associated with the return.
 *               items:
 *                 type: array
 *                 description: An updated array of returned items with product IDs and quantities.
 *               refundAmount:
 *                 type: number
 *                 description: The updated total refund amount for the return.
 *               reason:
 *                 type: string
 *                 description: An updated reason for the return.
 *     responses:
 *       '200':
 *         description: Successfully updated the sale return.
 *       '400':
 *         description: Bad request. Invalid input data.
 *       '404':
 *         description: Sale return not found.
 *       '500':
 *         description: Internal server error.
 */

router.put("/:id", returnController.updateSaleReturn);
/**
 * @swagger
 * /{id}:
 *   delete:
 *     summary: Delete a sale return by ID
 *     tags:
 *       - Sale Returns
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the sale return to delete.
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: Successfully deleted the sale return.
 *       '404':
 *         description: Sale return not found.
 *       '500':
 *         description: Internal server error.
 */

router.delete("/:id", returnController.deleteSaleReturn);
module.exports = router;
