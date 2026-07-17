const mongoose = require("mongoose");

const order = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sync: { type: Boolean, default: false },
  
  status: {
    type: String,
    enum: ["cancelled","completed","pending"],
    default: "pending",
  },
  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
    },
  ],
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  receiptNo: {
    type: String,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },
});
order.pre("save", function (next) {
  if (!this.receiptNo) {
    const prefix = "ORD"; // Customize the prefix as needed
    const randomPart = Math.floor(10000 + Math.random() * 900000);
    this.receiptNo = `${prefix}${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
order.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("Order", order);
