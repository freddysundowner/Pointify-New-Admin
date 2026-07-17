const express = require("express");
const router = express.Router();
const controller = require("../controllers/accompaniment");

// GET all accompaniments for a shop (used by POS on load)
router.get("/shop/:shopId", controller.getByShop);

// GET accompaniment config for one product
router.get("/:productId", controller.getByProduct);

// PUT (create or replace) accompaniment config for a product
router.put("/:productId", controller.upsert);

// DELETE accompaniment config for a product
router.delete("/:productId", controller.remove);

module.exports = router;
