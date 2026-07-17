const mongoose = require("mongoose");

const cashflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
    sync: { type: Boolean, default: false },
  amount: {
    type: Number,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CashFlowCategory",
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
    required: true,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bank",
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
cashflowSchema.plugin(markUnsyncedPlugin);
const Cashflow = mongoose.model("Cashflow", cashflowSchema);

module.exports = Cashflow;
