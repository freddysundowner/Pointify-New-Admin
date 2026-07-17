const mongoose = require("mongoose");

const bactchSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  sync: { type: Boolean, default: false },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  buyingPrice: {
    type: Number,
    default: 0,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  totalQuantity: {
    type: Number,
    default: 0,
  },
  expirationDate: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  batchCode: {
    type: String,
    unique: true, // Ensure the batch code is unique
  },
});
bactchSchema.pre("save", function (next) {
  if (!this.batchCode) {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Random 6-character alphanumeric string
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of the timestamp
    this.batchCode = `${randomCode}-${timestamp}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
bactchSchema.plugin(markUnsyncedPlugin);
const Batch = mongoose.model("Batch", bactchSchema);

module.exports = Batch;
