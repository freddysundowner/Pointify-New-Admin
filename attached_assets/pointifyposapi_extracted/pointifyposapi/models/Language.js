const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    sync: { type: Boolean, default: false },
    iso_code: {
      type: String,
      required: true,
    },

    flag: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      lowercase: true,
      enum: ["show", "hide"],
      default: "show",
    },
  },
  {
    timestamps: true,
  }
);

const Language = mongoose.model("Language", languageSchema);
module.exports = Language;
