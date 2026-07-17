const mongoose = require("mongoose");
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");

const activitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
  sync: { type: Boolean, default: false },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attendant",
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});
activitySchema.plugin(markUnsyncedPlugin);

module.exports = mongoose.model("Activity", activitySchema);
