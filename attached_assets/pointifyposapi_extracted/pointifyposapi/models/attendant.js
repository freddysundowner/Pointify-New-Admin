const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const attendantSchema = new Schema({
  username: {
    type: String,
  },
  sync: { type: Boolean, default: false },
  uniqueDigits: {
    type: Number,
    unique: true,
    required: true,
  },

  lastAppRatingDate: {
    type: Date,
    default: null,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
  },
  permissions: {
    type: Array,
  },
  last_seen: {
    type: Date,
    default: Date.now,
  },
  shopId: {
    type: Schema.Types.ObjectId,
    ref: "Shop", // Reference to the Shop model
  },
  adminId: {
    type: Schema.Types.ObjectId,
    ref: "Admin", // Reference to the Shop model
  },
});

const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
attendantSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("Attendant", attendantSchema);
