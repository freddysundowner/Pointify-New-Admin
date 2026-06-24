// models/ProductTransfer.js

const mongoose = require("mongoose");

const productTransferSchema = new mongoose.Schema({
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
    required: true,
  },
  sync: { type: Boolean, default: false },
  fromShopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  toShopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  productId: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
productTransferSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("ProductTransfer", productTransferSchema);
