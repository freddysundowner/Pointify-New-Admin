const mongoose = require("mongoose");

const renewTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true, index: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

// MongoDB TTL index — automatically deletes expired tokens
renewTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RenewToken", renewTokenSchema);