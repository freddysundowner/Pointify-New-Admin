const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sync: { type: Boolean, default: false },
  totalAmount: {
    type: Number,
    default: 0,
  },
  amountPaid: {
    type: Number,
    default: 0,
  },
  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseItem",
    },
  ],
  purchaseNo: {
    type: String,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },
  paymentType: {
    type: String,
    enum: ["cash", "credit",'mpesa','bank'],
    required: true,
  },
  outstandingBalance: {
    type: Number,
    default: 0,
  },
  payments: [
    {
      amount: {
        type: Number,
        required: true,
      },
      attendantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attendant",
        required: true,
      },
      paymentNo: {
        type: String,
      },
      balance: {
        type: Number,
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});
// Define a pre-save middleware to generate the purchaseNo
purchaseSchema.pre("save", function (next) {
  if (!this.purchaseNo) {
    // If purchaseNo is not already set, generate it
    const prefix = "PUR"; // Customize the prefix as needed
    const randomPart = Math.floor(100000 + Math.random() * 9000000);
    this.purchaseNo = `${prefix}${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
purchaseSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("Purchase", purchaseSchema);
