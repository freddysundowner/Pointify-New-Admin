const express = require("express");
const router = express.Router();
const attendantController = require("../controllers/attendant");

router.post("/", attendantController.createAttendant);
router.put("/:id", attendantController.updateAttendant);
router.get("/shop/filter", attendantController.getAttendantsByShopOrAdminId);
router.get("/:id", attendantController.getAttendantById);
router.delete("/:id", attendantController.deleteAttendant);
router.post("/login", attendantController.loginAattendant);
router.get("/all/:id",attendantController.getAllAttendants)
router.put("/reset/password/sms/:id", attendantController.resetPasswordSms);


module.exports = router;
 