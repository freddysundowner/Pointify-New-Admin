const mongoose = require("mongoose");

// Guest-house rooms are their OWN collection — NOT products/services.
const roomSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
        required: true,
    },
    name: { type: String, required: true },
    nightlyRate: { type: Number, required: true, min: 0 },
    amenities: { type: [String], default: [] },

    group: { type: String, default: "" },
    sync: { type: Boolean, default: false },
    createAt: {
        type: Date,
        default: Date.now,
    },
});

roomSchema.index({ shop: 1, name: 1 });

const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
roomSchema.plugin(markUnsyncedPlugin);

const Room = mongoose.model("Room", roomSchema);

module.exports = Room;
