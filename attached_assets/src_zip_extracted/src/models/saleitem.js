const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product", // Reference to the Product model
    required: true,
  },
  sync: { type: Boolean, default: false },
  quantity: {
    type: Number,
    required: true,
  },
  unitBuyingPrice:{
    type: Number,
    default: 0
  },
  manageByPrice:{
    type: Boolean,
    default: false,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
  },
  salesnote: {
    type: String,
  },
  status: {
    type: String,
    default: "cashed",
  },
  saleType: {
    type: String,
    enum: ["Retail", "Dealer", "Wholesale", "Order"],
    default: "Retail",
  },
  paymentTag: {
    type: String,
    default: "cash",
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sale", // Reference to the Purchase model
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },

  batch: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
    },
  ],
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop", // Reference to the Attendant model
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set the current date and time
  },
  lineDiscount: {
    type: Number, // New field for total discount
    default: 0, // Default to no discount
  },
});
saleItemSchema.virtual("total").get(function () {
  return this.unitPrice * this.quantity - this.lineDiscount;
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
saleItemSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("SaleItem", saleItemSchema);
