const mongoose = require("mongoose");
const { v4: uuidv4 
  } = require('uuid');

const bundleItemSchema = new mongoose.Schema({
  item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
  },
  sync: { type: Boolean, default: false },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  item_product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  quantity: {
    type: Number,
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
bundleItemSchema.plugin(markUnsyncedPlugin);
const BundleItem = mongoose.model("BundleItem", bundleItemSchema);

module.exports = BundleItem;
