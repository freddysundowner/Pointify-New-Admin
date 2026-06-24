const mongoose = require("mongoose");

const productCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
productCategorySchema.plugin(markUnsyncedPlugin);
const ProductCategory = mongoose.model(
  "ProductCategory",
  productCategorySchema
);

module.exports = ProductCategory;
