const mongoose = require("mongoose");

const emailSent= new mongoose.Schema({
  subject: {
    type: String,
    required: true,
  },
  sync: { type: Boolean, default: false },
  emailTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmailMessage",
  },
  usersCount: {
    type: Number,
    },
  
  createAt: {
    type: Date,
    default: Date.now,
  },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
emailSent.plugin(markUnsyncedPlugin);
const EmailSent = mongoose.model("EmailSent", emailSent);

module.exports = EmailSent;
