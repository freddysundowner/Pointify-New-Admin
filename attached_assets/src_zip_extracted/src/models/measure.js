const mongoose = require("mongoose");

const measureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  ,
  sync: { type: Boolean, default: false }},
  // shop: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Shop",
  // },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
measureSchema.plugin(markUnsyncedPlugin);
const Measure = mongoose.model("Measure", measureSchema);

module.exports = Measure;
