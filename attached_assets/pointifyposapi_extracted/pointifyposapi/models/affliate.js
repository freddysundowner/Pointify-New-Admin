const mongoose = require("mongoose");
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");

const affliateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  phonenumber: {
    type: String,
  },
  email: {
    type: String,
  },
  address: {
    type: String,
  },
  password: {
      type: String,
  },
  country: {
    type: String,
  },
  commission: {
    type: Number,
    default: 20
  },
  wallet: {
    type: Number,
    default: 0,
  },
  blocked: {
    type: Boolean,
    default: false,
  },
  active: { 
    type: Boolean,
    default: false,
  },
  code: {
    type: String,
    default: 123456,
  },
    otp: {
      type: Number,
    },
    otp_expiry: {
      type: Number,
    },

  createAt: {
    type: Date,
    default: Date.now,
  },
});

affliateSchema.pre("save", function (next) {
  if (!this.code) {
    const randomPart = Math.floor(100000 + Math.random() * 9000000);
    this.code = randomPart;
  }
  next();
});
affliateSchema.plugin(markUnsyncedPlugin);
const Affliate = mongoose.model("Affliate", affliateSchema);

module.exports = Affliate;
