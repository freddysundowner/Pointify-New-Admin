const mongoose = require("mongoose");

const smsLogSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
            index: true,
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shop",
            index: true,
        },
        saleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Sale",
            index: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
        },

        phone: String,
        message: String,

        characterCount: {
            type: Number,
            default: 0,
        },
        smsParts: {
            type: Number,
            default: 1,
        },
        creditUsed: {
            type: Number,
            default: 1,
        },

        smsType: {
            type: String,
            enum: ["sale", "otp", "custom", "other"],
            default: "sale",
        },

        status: {
            type: String,
            enum: ["success", "failed"],
            default: "success",
            index: true,
        },

        providerResponse: mongoose.Schema.Types.Mixed,
        errorMessage: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model("SmsLog", smsLogSchema);