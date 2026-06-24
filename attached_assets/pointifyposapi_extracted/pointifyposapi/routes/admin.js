const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin");
router.put("/:id", adminController.updateAdmin);
router.post("/verifyemail", adminController.verifyemail);
router.post("/sendverificationemail", adminController.sendverificationemail);
router.delete("/:id", adminController.deleteAdmin);
router.get("/", adminController.getAdmins);
router.get("/search", adminController.searchAdmin);
router.get("/permissions", adminController.permissions)
router.get("/single/user",adminController.getLocalAdmin)
router.get("/users/subscriptions",adminController.getAdminsBySubscriptionStatus)
module.exports = router; 