const express = require("express");
const router = express.Router();
const transferController = require("../controllers/transfer");

router.post("/shop/transfer", transferController.transferProducts);


router.get("/filter", transferController.getTransferredProductsByShop);
router.get(
  "/product/:id",
  transferController.getProductTransferHistoryByProductId
);
module.exports = router;
