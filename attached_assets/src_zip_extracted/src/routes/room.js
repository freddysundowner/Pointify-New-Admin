const express = require("express");
const router = express.Router();
const {
    getAllRooms,
    createRoom,
    bulkCreateRooms,
    updateRoomById,
    deleteRoomById,
} = require("../controllers/room");

router.get("/", getAllRooms);
router.post("/", createRoom);
router.post("/bulk", bulkCreateRooms);
router.put("/:id", updateRoomById);
router.delete("/:id", deleteRoomById);

module.exports = router;
