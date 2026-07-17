const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier");

router.post("/", supplierController.createSupplier);
router.get("/supplier/:supplier", supplierController.getSupplierSupplies);
router.get("/", supplierController.getAllSuppliers);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier);
router.post("/import/suppliers", supplierController.importSuppliers);
router.post("/bulk/delete/suppliers", supplierController.bulkDeleteSuppliers);
module.exports = router;
