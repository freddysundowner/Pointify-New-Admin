const mongoose = require("mongoose");

const saleReturnSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sale",
    required: true,
  },
  sync: { type: Boolean, default: false },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },
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
  items: [
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
      unitPrice: {
        type: Number,
        required: true,
      },
    },
  ],
  refundAmount: {
    type: Number,
    required: true,
  },
  reason: String,
  saleReturnNo: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
saleReturnSchema.pre("save", function (next) {
  if (!this.saleReturnNo) {
    // If purchaseNo is not already set, generate it
    const prefix = "RTN"; // Customize the prefix as needed
    const randomPart = Math.floor(1000000 + Math.random() * 9000000);
    this.saleReturnNo = `${prefix}-${randomPart}`;
  }

  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
saleReturnSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("SaleReturn", saleReturnSchema);
