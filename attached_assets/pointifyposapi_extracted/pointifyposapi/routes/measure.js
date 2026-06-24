const express = require("express");
const router = express.Router();
const measureController = require("../controllers/measure");
/**
 * @swagger
 * /measures:
 *   post:
 *     summary: Create a new measure
 *     description: Create a new measure with a name.
 *     tags:
 *       - Measures
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Measure created successfully.
 *       500:
 *         description: Internal server error.
 */
// Create a new measure
router.post("/", measureController.createMeasure);
/**
 * @swagger
 * /measures/{id}:
 *   get:
 *     summary: Get  measure by id
 *     description: Retrieve measure by id.
 *     tags:
 *       - Measures
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the measure.
 *         schema:
 *           type: string
 *           format: ObjectId
 *     responses:
 *       200:
 *         description: measure by id.
 *       500:
 *         description: Internal server error.
 */
// Get all measures
router.get("/:id", measureController.getMeasureById);
/**
 * @swagger
 * /measures:
 *   get:
 *     summary: Get all measures
 *     description: Retrieve a list of all measures in the system.
 *     tags:
 *       - Measures
 *     responses:
 *       200:
 *         description: A list of measures.
 *       500:
 *         description: Internal server error.
 */
// Get all measures
router.get("/", measureController.getAllMeasures);
/**
 * @swagger
 * /measures/{id}:
 *   put:
 *     summary: Update a measure by ID
 *     description: Update a measure's name by its unique ID.
 *     tags:
 *       - Measures
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the measure.
 *         schema:
 *           type: string
 *           format: ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *             required:
 *               - name
 *     responses:
 *       200:
 *         description: Measure updated successfully.
 *       404:
 *         description: Measure not found.
 *       500:
 *         description: Internal server error.
 */
// Update a measure by ID
router.put("/:id", measureController.updateMeasure);
/**
 * @swagger
 * /measures/{id}:
 *   delete:
 *     summary: Delete a measure by ID
 *     description: Delete a measure by its unique ID.
 *     tags:
 *       - Measures
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the measure.
 *         schema:
 *           type: string
 *           format: ObjectId
 *     responses:
 *       204:
 *         description: Measure deleted successfully.
 *       404:
 *         description: Measure not found.
 *       500:
 *         description: Internal server error.
 */
// Delete a measure by ID
router.delete("/:id", measureController.deleteMeasure);

module.exports = router;
