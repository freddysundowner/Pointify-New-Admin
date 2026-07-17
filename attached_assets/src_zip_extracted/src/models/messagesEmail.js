const mongoose = require("mongoose");

const messageEmail = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  body: {
    type: String,
    required: true,
  },
  sheduled: {
    type: Boolean,
    default: false
  },
  interval: {
    type: String,
    enum: ['daily', 'monthly', "once_weekly"],
    default: 'monthly'
  },
  campaign: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: ""
  },
  audience: {
    type: String,
    enum: ['subscribers', 'all', 'expired', 'dormant','custom'],
    default:"custom"
  },
  audienceAddress: {
    type: String,
    default: ''
  },
  sentCount: {
    type: Number,
    default: 0 
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
});

const EmailMessage = mongoose.model("EmailMessage", messageEmail);

module.exports = EmailMessage;
