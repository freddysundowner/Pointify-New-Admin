const mongoose = require("mongoose");

const purchaseReturnSchema = new mongoose.Schema({
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase",
    required: true,
  },
  sync: { type: Boolean, default: false },
  paymentType: {
    type: String,
    enum: ["cash", "credit", "mpesa", "bank"],
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
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
  purchaseReturnNo: {
    type: String,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
purchaseReturnSchema.pre("save", function (next) {
  if (!this.purchaseReturnNo) {
    // If purchaseNo is not already set, generate it
    const prefix = "RTN"; // Customize the prefix as needed
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.purchaseReturnNo = `${prefix}-${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
purchaseReturnSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("PurchaseReturn", purchaseReturnSchema);
