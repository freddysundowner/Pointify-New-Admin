const mongoose = require("mongoose");

const awardsSchema = new mongoose.Schema({
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
  mpesaCode: {
    type: String,
    default: Date.now()
  },
  paymentNo: {
    type: String,
    unique: true,
  },
  currency: {
    type: String,
    default: 'kes'
  },
  type: {
    type: String,
    enum: ["earnings", "usage"],
    required: true,
  },
  shops: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
    }
  ],
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  awardType: {
    type: String,
    enum: ["open_shop", "subscription"],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Affliate",
  },
  affliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Affliate",
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
});
awardsSchema.pre("save", function (next) {
  if (!this.paymentNo) {
    this.paymentNo =
      "REC" +
      Date.now() +
      Math.floor(Math.random() * 1000);
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
awardsSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("awards", awardsSchema);
