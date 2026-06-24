const express = require("express");
const router = express.Router();
const productController = require("../controllers/product");
router.post("/category/", productController.createProductCategory);
router.get("/category/", productController.getAllProductCategories);
router.put("/category/:id", productController.updateProductCategory);
router.delete("/category/:id", productController.deleteProductCategory);

router.get("/category/all/:id", productController.getProductCategoryById);
router.post("/", productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/admin/products", productController.getProducts);
router.put("/:id", productController.updateProduct);
router.put("/bardcode/:id", productController.updateBarcode);

router.get("/:id", productController.getProductById);
router.get("/product/search", productController.searchProducts);
router.delete("/:id", productController.deleteProduct);
router.put("/remove/bundle/item", productController.removebundleitem);
router.get("/product/summary", productController.getProductSummary);
router.get("/shop/:shopId", productController.getProductsByShopId);
router.post("/import/products", productController.importProducts);

router.get("/stats/summary", productController.productstats);

router.post("/transfer/products", productController.transferProducts);

router.get("/stockreport/:shopId", productController.getStockReport);

router.put("/images/:id", productController.updateProductImages);
router.post("/report", productController.generateResports);
router.put("/adjust/:id", productController.adjustStock);
router.get("/adjust/:id", productController.getProductAdjustments);
router.get("/bundle/items/:id", productController.getProductBundleItems)
router.get("/history/product", productController.getStockAndSalesSummary)
router.delete("/bulk/delete", productController.bulkDelete)
module.exports = router;
 