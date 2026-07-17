const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  phoneNumber: {
    type: String,
  },
  email: {
    type: String,
  },
  address: {
    type: String, 
  },
  wallet: {
    type: Number,
    default: 0,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
supplierSchema.plugin(markUnsyncedPlugin);
const Supplier = mongoose.model("Supplier", supplierSchema);

module.exports = Supplier;
