const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    sync: { type: Boolean, default: false },
    setting: {},
  },
  {
    timestamps: true, 
  }
);

// module.exports = settingSchema;
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
settingSchema.plugin(markUnsyncedPlugin);
const Setting = mongoose.model("Setting", settingSchema);

module.exports = Setting;
