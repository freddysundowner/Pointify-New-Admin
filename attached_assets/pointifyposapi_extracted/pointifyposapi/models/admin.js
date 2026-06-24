const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const attendant = require("./attendant");
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");

const adminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: [true, "Email already exists"],
    },
    pricingGroup: {
      type: String,
      enum: ["old", "new"],
      default: "new"
    },
    saleSmsEnabled: {
      type: Boolean, default: false
    },
    saleSmsSender: {
      type: String,
      default: ""
    },
    saleSmsTemplate: {
      type: String,
      default: ""
    },
    sync: { type: Boolean, default: false },
    autoPrint: {
      type: Boolean,
      default: true,
    },
    smscredit: {
      type: Number,
      default: 0.0,
    },
    permissions: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: "online",
      enum: ["online", "offline", "hybrid"],
    },
    syncInterval: {
      type: Number,
      default: 0,
    },
    username: {
      type: String,
    },
    attendantId: {
      type: Schema.Types.ObjectId,
      ref: "Attendant",
    },
    primaryShop: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
    },
    password: {
      type: String,
      required: true,
    },
    lastAppRatingDate: {
      type: Date,
      default: null,
    },
    otp: {
      type: Number,
    },
    referalCredit: {
      type: Number,
    },
    otp_expiry: {
      type: Number,
    },
    emailVerificationDate: {
      type: Date,
      default: Date.now,
    },
    phone: {
      type: String,
      required: true,
    },
    last_seen: {
      type: Date,
      default: Date.now,
    },
    platform: {
      type: String,
      default: null,
    },
    app_version: {
      type: String,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    referal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    lastSubscriptionReminder: {
      type: Date,
      default: Date.now,
    },
    lastSubscriptionReminderCount: {
      type: Number,
      default: 0,
    },

    affliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affliate",
      default: null,
    },
  },
  {
    versionKey: false, // Exclude the __v field by default
  }
);

// You can add pre-save hooks to hash the password before saving to the database

adminSchema.pre("save", async function (next) {
  if (!this.attendantId) {
    try {
      const adminData = this.toObject(); // Convert admin data to an object
      const attendantData = {
        username: adminData.username, // You can use the admin's username for the attendant
        uniqueDigits: Math.floor(Math.random() * 10000), // Generate a uniqueDigits value
        password: adminData.password, // Use the same password as the admin
        adminId: this._id,
      };

      const attendantt = new attendant(attendantData);
      await attendantt.save();

      this.attendantId = attendantt._id;
    } catch (error) {
      return next(error);
    }
  }

  next();
});
adminSchema.plugin(markUnsyncedPlugin);

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
