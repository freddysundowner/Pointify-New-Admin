const express = require("express");
const router = express.Router();
const syncController = require("../controllers/sync");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });
router.get("/:id", syncController.getDump);
router.post("/dump", syncController.pullImport);
router.post(
  "/dump/online",
  upload.single("file"),
  syncController.pullOnlineImport
);
router.delete("/:id", syncController.cleanUpFiles);
router.get("/database/init", syncController.initDatabase);
router.get("/checkupdate/desktop", syncController.checkUpdate);
module.exports = router;
 