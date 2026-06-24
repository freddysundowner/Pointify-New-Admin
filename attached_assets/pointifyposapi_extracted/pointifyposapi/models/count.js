  const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  sync: { type: Boolean, default: false },
  physicalCount: {
    type: Number,
    required: true,
  },
  initialCount: {
    type: Number,
    required: true,
  },
  variance: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const stockCountSchema = new mongoose.Schema({
  products: [productSchema],
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
stockCountSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("StockCount", stockCountSchema);
