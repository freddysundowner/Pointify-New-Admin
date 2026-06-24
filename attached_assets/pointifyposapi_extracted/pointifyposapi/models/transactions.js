const mongoose = require("mongoose");

const transactionsSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sync: { type: Boolean, default: false },
  amount: {
    type: Number,
  },
  affliateAmount: {
    type: Number,
  },
  balance: {
    type: Number,
  },
  transId: {
    type: String,
  },
  mpesaCode: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    enum: ["withdraw", "subscription"],
    required: true,
  },
  status: {
    type: Boolean,
    default: false,
  },
  affliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Affliate",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
});
// Define a pre-save middleware to generate the purchaseNo
transactionsSchema.pre("save", function (next) {
  if (!this.transId) {
    // If transId is not already set, generate it
    const prefix = "TRAN"; // Customize the prefix as needed
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.transId = `${prefix}${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
transactionsSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("Transactions", transactionsSchema);
