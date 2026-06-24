const mongoose = require("mongoose");
const requestSchema = new mongoose.Schema({
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory",
  },
  sync: { type: Boolean, default: false },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  quantity: {
    type: Number,
    required: true,
  },
  received: {
    type: Number,
    default: 0,
  },
});
const stockRequestSchema = new mongoose.Schema({
  requestData: [requestSchema],
  attendant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
    required: true,
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },
  status: {
    type: String,
    enum: ["pending", "processed", "correction", "void", "completed"],
    default: "pending",
  },
  fromShop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  total: {
    type: Number,
    default: 0,
  },
  acceptedDate: {
    type: Date,
    default: null,
  },
  dispatchedDate: {
    type: Date,
    default: null,
  },
  invoiceNumber: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

stockRequestSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    const prefix = "INV";
    const randomPart = Math.floor(10000 + Math.random() * 900000);
    this.invoiceNumber = `${prefix}${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
stockRequestSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("stockrequest", stockRequestSchema);
