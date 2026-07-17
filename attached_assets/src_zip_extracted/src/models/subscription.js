const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin', // Assuming 'Admin' is the name of your user model
    required: true,
  },
  sync: { type: Boolean, default: false },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  }, 
  shops: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    }
  ],
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true,
  },
  mpesaCode: {
    type: String,
  },

  amount:{
    type: Number,
    default: 0
  },
  invoiceNo: {
    type: String,
  },
  type: {
    type: String,
  },
  status: {
    type: Boolean,
    default:false
  },
  commission: {
    type: Number,
    default:0
  },
  currency: {
    type: String,
    default:"kes"
  },
  paid: {
    type: Boolean,
    default:false
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
subscriptionSchema.plugin(markUnsyncedPlugin);
const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
