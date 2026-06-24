const mongoose = require("mongoose");
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");

const productAdjustmentSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  sync: { type: Boolean, default: false },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  type: {
    type: String,
    default: "add",
    enum: ['add','remove']
  },
  before: {
    type: Number,
    required: true,
  },
  after: {
    type: Number,
    required: true,
  },
  adjusted: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
productAdjustmentSchema.plugin(markUnsyncedPlugin);

module.exports = mongoose.model("Adjustment", productAdjustmentSchema);
