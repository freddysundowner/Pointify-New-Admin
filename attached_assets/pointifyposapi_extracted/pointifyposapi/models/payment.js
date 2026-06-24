const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sync: { type: Boolean, default: false },
  totalAmount: {
    type: Number,
  },
  balance: {
    type: Number,
  },
  paymentNo: {
    type: String,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },

  mpesaCode: {
    type: String,
    default: null,
  },
  paymentType: {
    type: String,
  },
  type: {
    type: String,
    enum: ["deposit", "withdraw", "payment", "refund"],
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
  },
});
// Define a pre-save middleware to generate the purchaseNo
paymentSchema.pre("save", function (next) {
  if (!this.paymentNo) {
    // If paymentNo is not already set, generate it
    const prefix = "REC"; // Customize the prefix as needed
    const randomPart = Math.floor(100000 + Math.random() * 9000000);
    this.paymentNo = `${prefix}${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
paymentSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("UserPayment", paymentSchema);
