// models/BadStock.js
const mongoose = require('mongoose');

const badStockSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product", // Reference to the Product model
    required: true,
  },
  sync: { type: Boolean, default: false },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop", // Reference to the Shop model
    required: true,
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant", // Reference to the Attendant model
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
badStockSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model('BadStock', badStockSchema);
