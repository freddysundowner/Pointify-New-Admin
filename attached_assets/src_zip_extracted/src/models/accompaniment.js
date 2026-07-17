const mongoose = require("mongoose");

const accompanimentOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const accompanimentGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    // fixed  = always included automatically (no customer choice needed)
    // choice = customer picks exactly one option from the list
    type: { type: String, enum: ["fixed", "choice"], default: "choice" },
    options: [accompanimentOptionSchema],
  },
  { _id: false }
);

const accompanimentSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    groups: [accompanimentGroupSchema],
  },
  { timestamps: true }
);

// One config document per product per shop
accompanimentSchema.index({ productId: 1, shopId: 1 }, { unique: true });

module.exports = mongoose.model("Accompaniment", accompanimentSchema);
