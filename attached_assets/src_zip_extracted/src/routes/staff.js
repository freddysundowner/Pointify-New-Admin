const express = require("express");
const router = express.Router();

const staffController = require("../controllers/staff");
router.post("/", staffController.login);
module.exports = router;