const mongoose = require("mongoose");

const communicationSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        lowercase: true,
        enum: ["sent", "failed"],
        default: "sent",
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
    },
    type: {
        type: String,
        lowercase: true,
        enum: ["email", "sms"],
        default: "email",
    },
    contact: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    failedreason: {
        type: String,
    },
});
module.exports = mongoose.model("communication", communicationSchema);
