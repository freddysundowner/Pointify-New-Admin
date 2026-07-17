const express = require("express");
const router = express.Router();
const {
    createBooking,
    getAllBookings,
    checkoutBooking,
    updateBookingById,
    deleteBookingById,
    getBookingStats,
} = require("../controllers/bookings");

router.post("/", createBooking);
router.get("/", getAllBookings);
router.post("/:id/checkout", checkoutBooking);
router.put("/:id", updateBookingById);
router.delete("/:id", deleteBookingById);
router.get("/stats", getBookingStats);
module.exports = router;
