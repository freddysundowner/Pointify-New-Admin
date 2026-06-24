const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const inventory = new mongoose.Schema({
  quantity: {
    type: Number,
  },
  sync: { type: Boolean, default: false },
  lastCount: {
    type: Number,
    default: 0,
  },
  bundle: {
    type: Boolean,
    default: false,
  },
  repairVersion: {
    type: Number,
    default: 2,
  },
  bundleItems: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BundleItem",
    },
  ],
  reorderLevel: {
    type: Number,
    default: 0,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WareHouse",
  },
  type: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    default: null,
  },
  attendant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
    required: true,
  },
  lastcoundate: {
    type: Date,
    default: null,
  },
  expiryDate: {
    type: Date,
    default: null,
  },
  barcode: {
    type: String,
    default: null,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});
inventory.pre("save", function (next) {
  if (!this.barcode) {
    this.barcode = uuidv4();
  }
  next();
},
  {
    timestamps: true,
  });
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
inventory.plugin(markUnsyncedPlugin);
const Inventory = mongoose.model("Inventory", inventory);

module.exports = Inventory;
