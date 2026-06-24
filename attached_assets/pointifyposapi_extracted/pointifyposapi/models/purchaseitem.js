const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product", // Reference to the Product model
    required: true,
  },
  sync: { type: Boolean, default: false },
  quantity: {
    type: Number,
    default:0
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase", 
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop", 
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant", 
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
purchaseItemSchema.virtual("total").get(function () {
  return (this.unitPrice * this.quantity) - this.lineDiscount;
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
purchaseItemSchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("PurchaseItem", purchaseItemSchema);
