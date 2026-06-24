// PackageModel.js

const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  sync: { type: Boolean, default: false },
  description: { type: String, },
  durationValue: { type: Number, required: true }, // Numeric value of the duration
  durationUnit: {
    type: String,
    enum: ['days', 'weeks', 'months', 'years'], // Enum for time units
    required: true,
  },

  newAmount: { type: Number, default: 0 },
  newAmountusd: { type: Number, default: 0 },
  newDurationValue: { type: Number, default: 30 },
  newDurationUnit: {
    type: String,
    enum: ['days', 'weeks', 'months', 'years'],
    default: 'days',
  },
  newTitle: { type: String, default: '' }, 
  newMaxShops: { type: Number, default: 2 },
  amount: { type: Number, required: true },
  amountusd: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  status: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  type: { type: String, enum: ['trial', 'production'], required: true },
  features: [String],
  maxShops: { type: Number, }
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
packageSchema.plugin(markUnsyncedPlugin);
const Package = mongoose.model('Package', packageSchema);

module.exports = Package;
