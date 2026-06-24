const mongoose = require("mongoose");

const cashflowCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  type: {
    type: String,
    required: true,
    enum: ["cashin", "cashout"],
  },

  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
cashflowCategorySchema.plugin(markUnsyncedPlugin);
const CashFlowCategory = mongoose.model(
  "CashFlowCategory",
  cashflowCategorySchema
);

module.exports = CashFlowCategory;
