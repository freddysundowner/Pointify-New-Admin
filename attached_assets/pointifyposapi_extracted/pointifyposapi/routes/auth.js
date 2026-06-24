const express = require("express");
const router = express.Router();
const adminController = require("../controllers/auth");
const passport = require("passport");

router.post("/register", adminController.registerAdmin);

router.post("/login", adminController.loginAdmin);

router.get("/admin/:id", adminController.getAdminById);

router.post("/admin/reset/password", adminController.resetPasswrod);

router.post("/admin/request/password", adminController.resetPasswordRequest);
router.post("/admin/save/admin/local", adminController.saveAdminLocally);
router.post("/reset/password/sms", adminController.resetPasswordSms);

module.exports = router;
