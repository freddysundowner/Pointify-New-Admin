const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
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
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  address: {
    type: String,
  },
  password: {
      type: String,
    },
  type: {
    type: String,
    default:null
  },
  email: {
    type: String,
    default:null
  },
  creditLimit: {
    type: Number,
    default: null,
  },
  wallet: {
    type: Number,
    default: 0,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },

    otp: {
      type: Number,
    },
    otp_expiry: {
      type: Number,
    },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },
  customerNo: {
    type: Number
  },


  createAt: {
    type: Date,
    default: Date.now,
  },
});

customerSchema.pre("save", async function (next) {
  try {
    if (!this.customerNo) {
      // Generate a unique customerNo if it doesn't exist
      const lastCustomer = await this.constructor.findOne({customerNo: {$ne : null}}, {}, { sort: { customerNo: -1 } });
      this.customerNo = lastCustomer ? lastCustomer.customerNo + 1 : 1;
    }
    next();
  } catch (error) {
    next(error);
  }
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
customerSchema.plugin(markUnsyncedPlugin);
const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
