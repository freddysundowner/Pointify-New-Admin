const mongoose = require("mongoose");
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");

// A sales lead owned by an affiliate (partner). Everything is scoped by the
// `affiliate` reference so a partner only ever sees their own pipeline.
const leadSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Affliate",
    required: true,
    index: true,
  },
  businessName: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
  },
  phonenumber: {
    type: String,
  },
  businessType: {
    type: String,
  },
  location: {
    type: String,
  },
  // Referral | Field Sales | Digital | Follow-Up
  source: {
    type: String,
  },
  // Pipeline stage. Defaults to the first stage for a brand-new lead.
  stage: {
    type: String,
    default: "New Lead",
  },
  nextFollowUpDate: {
    type: Date,
  },
  notes: {
    type: String,
  },
  // Activity timeline. Entries are appended by the controller — automatically
  // for lifecycle events (created / stage_changed / follow_up_set /
  // details_updated) and manually for partner notes (action: "note").
  activities: [
    {
      action: { type: String, required: true },
      from: { type: String },
      to: { type: String },
      note: { type: String },
      at: { type: Date, default: Date.now },
    },
  ],
  sync: { type: Boolean, default: false },
  createAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

leadSchema.plugin(markUnsyncedPlugin);
const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;
