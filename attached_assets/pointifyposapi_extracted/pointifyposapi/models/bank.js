const mongoose = require("mongoose");

const bankScheama = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  amount: {
    type: Number,
    required: true,
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
bankScheama.plugin(markUnsyncedPlugin);
const Cashflow = mongoose.model("Bank", bankScheama);

module.exports = Cashflow;
