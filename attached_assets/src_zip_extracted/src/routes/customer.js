const express = require("express");
const router = express.Router();
const {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getPayments,
  customerVerify,
  getCustomerNo,
  getAllDebstorsExcel,
  getAllDebstors,
  importCustomers,
  deleteCustomerPayment,getCustomerAnalysis,getOverdueCustomers
} = require("../controllers/customer"); 
router.post("/", createCustomer);

router.post("/verify", customerVerify);
router.get("/", getAllCustomers);
// Retrieve a single customer by ID
router.get("/customerno", getCustomerNo);

// Retrieve a single customer by ID
router.get("/:customerId", getCustomerById);

// Update a customer by ID
router.put("/:customerId", updateCustomer);

// Delete a customer by ID
router.delete("/:customerId", deleteCustomer);
router.get("/payments/:customerId", getPayments);
router.get("/customers/debtors/excel", getAllDebstorsExcel);
router.get("/customers/debtors", getAllDebstors);
router.post("/import/customers", importCustomers);
router.delete("/payments/delete/:id",deleteCustomerPayment)

router.get("/analysis/:shopId",getCustomerAnalysis)
router.get("/overdue/:shopId",getOverdueCustomers)
module.exports = router;
