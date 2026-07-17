const mongoose = require("mongoose");

const exepensesSchema = new mongoose.Schema({
  description: {
    type: String,
  },
  sync: { type: Boolean, default: false },
  amount: {
    type: Number,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  lastRunDate: {
    type: Date,
    default: null,
  },
  attendant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExpenseCategory",
  },
  autoSave: {
    type: Boolean,
    default: false,
  },
  frequency: {
    type: String,
  },
  nextOccurrence: { type: Date, default: null },
  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
exepensesSchema.plugin(markUnsyncedPlugin);
const Expenses = mongoose.model("Expenses", exepensesSchema);

module.exports = Expenses;
