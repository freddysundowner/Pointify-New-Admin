const router = require("express").Router();

const {
  saveSettings,
  getSettings
} = require("../controllers/settingController");
router.post("/", saveSettings); 
router.get("/", getSettings);
module.exports = router;
 