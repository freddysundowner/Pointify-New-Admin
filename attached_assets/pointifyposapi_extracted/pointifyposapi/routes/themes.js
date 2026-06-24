const express = require('express');
const router = express.Router();

const themeController = require("../controllers/themes");
const upload = require("../middleware/upload");

router.post("/", upload.single("image"), themeController.createTheme);
router.get("/", themeController.getTheme);
module.exports = router;