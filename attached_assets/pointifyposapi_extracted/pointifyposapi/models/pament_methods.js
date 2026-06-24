const mongoose = require("mongoose");

const paymentMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    settings: {
        type: Object,
        required: true,
    },
    active: {
        type: Boolean,
        default: true,
    },
});
module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);