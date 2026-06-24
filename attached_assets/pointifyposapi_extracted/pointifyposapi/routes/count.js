const express = require("express");
const router = express.Router();
const countController = require("../controllers/count");
/**
 * @swagger
 * /counts:
 *   post:
 *     summary: Create a new stock count entry
 *     tags:
 *       - Stock Counts
 *     requestBody:
 *       description: Stock count details
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attendantId:
 *                 type: string
 *               shopId:
 *                 type: string
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     physicalCount:
 *                       type: number
 *     responses:
 *       '201':
 *         description: Stock count created successfully.
 *       '500':
 *         description: Internal server error.
 */

router.post("/", countController.createStockCount);
/**
 * @swagger
 * /counts/shop/{shopId}:
 *   get:
 *     summary: Get stock counts by shopId
 *     tags:
 *       - Stock Counts
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         description: The ID of the shop to retrieve stock counts from.
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         description: date to filter with.
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successfully retrieved stock counts by shopId.
 *       '500':
 *         description: Internal server error.
 */

router.get("/shop/:shopId", countController.getStockCountsByShopId);
/**
 * @swagger
 * /counts/product/{productId}:
 *   get:
 *     summary: Get stock counts by productId
 *     tags:
 *       - Stock Counts
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         description: The ID of the product to retrieve stock counts for.
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successfully retrieved stock counts by productId.
 *       '500':
 *         description: Internal server error.
 */

router.get("/product/:productId", countController.getStockCountsByProductId);

/**
 * @swagger
 * /counts/product/{productId}/year/{year}:
 *   get:
 *     summary: Get product counts by productId, year, and group by month
 *     tags:
 *       - Stock Counts
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         description: The ID of the product to retrieve product counts for.
 *         schema:
 *           type: string
 *       - in: path
 *         name: year
 *         required: true
 *         description: The specific year to filter counts.
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Successfully retrieved product counts by productId and year.
 *       '500':
 *         description: Internal server error.
 */

router.get(
  "/product/:productId/year/:year",
  countController.getProductCountsByProductIdAndYear
);
/**
 * @swagger
 * /counts/product/count/filter:
 *   get:
 *     summary: Get products filtered by counting status.
 *     tags:
 *       - Stock Counts
 *     parameters:
 *       - name: neverCounted
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter products that have never been counted.
 *       - name: countedToday
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter products that have been counted today.
 *       - name: notCountedToday
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter products that have not been counted today.
 *     responses:
 *       '200':
 *         description: Successfully retrieved products based on the filters.
 *         content:
 *           application/json:
 *             example:
 *               - _id: 5f3f4ed36c5b6e2f4a10bc21
 *                 name: Product A
 *                 description: This product has never been counted.
 *               - _id: 5f3f4ed36c5b6e2f4a10bc22
 *                 name: Product B
 *                 description: Another product that has never been counted.
 *       '500':
 *         description: Internal server error.
 */

router.get("/product/count/filter", countController.getProductsCountFilter);
/**
 * @swagger
 * /counts/product/count/product/search:
 *   get:
 *     summary: Get the count of products by name
 *     tags:
 *       - Stock Counts
 *     description: Retrieve the count of products with a specific name that have been counted.
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         required: true
 *         description: The name of the product to count.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               count: 5
 */

router.get(
  "/product/count/product/search",
  countController.getCountByProductName
);

/**
 * @swagger
 * /counts/{id}:
 *   delete:
 *     summary: Delete a customer by ID
 *     tags: [Stock Counts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Successful response
 */

// Delete a customer by ID
router.delete("/:id", countController.deleteStockCount);

module.exports = router;
