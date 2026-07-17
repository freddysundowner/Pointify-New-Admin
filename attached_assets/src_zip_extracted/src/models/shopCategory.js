// models/shopCategory.js
const mongoose = require("mongoose");

const shopCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  active: {
    type: Boolean,
    default: true,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
shopCategorySchema.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("ShopCategory", shopCategorySchema);
