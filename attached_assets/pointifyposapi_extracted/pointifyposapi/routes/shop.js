// routes/shopCategoryRoutes.js
const express = require("express");
const router = express.Router();
const shopController = require("../controllers/shop");

router.post("/category", shopController.createShopCategory);

router.get("/category", shopController.getAllShopCategories);

router.get("/category/:id", shopController.getShopCategoryById);

router.delete("/category/:id", shopController.deleteShopCategoryById);


router.put("/category/:id", shopController.updateShopCategoryById);

router.get("/", shopController.getAllShops);

router.post("/", shopController.createShop);

router.get("/:id", shopController.getShopById);

router.put("/:id", shopController.updateShopById);

router.delete("/data/:id", shopController.deleteShopDataById);

// Delete a shop by ID
router.delete("/:id", shopController.deleteShopById);

router.get("/shop/category/:id", shopController.getShopsByCategory);

router.get("/admin/:adminId", shopController.getShopsByAdminId);


router.get("/referal/shops/:id", shopController.getShopsByReferralId);

router.post("/redeem/usage/:shopid", shopController.redeemUsage);
router.put("/backup/interval/:id", shopController.updateBackupInterval);
router.get("/stats/metrics", shopController.getShopStats);
module.exports = router;
 