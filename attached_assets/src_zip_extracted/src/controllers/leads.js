const Lead = require("../models/leads");

// The affiliate id is supplied by the trusted admin proxy (derived from a signed
// partner session), NOT by the browser directly. It arrives as a query param on
// reads/deletes and in the body on create. Every query is scoped by it so a
// partner can only ever touch their own leads.
function getAffiliate(req) {
  return req.query.affiliate || (req.body && req.body.affiliate);
}

// Whitelist of client-writable fields. affiliate / _id / timestamps are never
// taken from the request body on update.
const WRITABLE = [
  "businessName",
  "contactPerson",
  "phonenumber",
  "businessType",
  "location",
  "source",
  "stage",
  "nextFollowUpDate",
  "notes",
];

function pickWritable(body) {
  const out = {};
  for (const key of WRITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

// Create a new lead for the affiliate.
async function createLead(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const fields = pickWritable(req.body || {});
    if (!fields.businessName || String(fields.businessName).trim() === "") {
      return res.status(400).json({ message: "businessName is required" });
    }
    if (!fields.stage) fields.stage = "New Lead";
    const lead = await Lead.create({
      ...fields,
      affiliate,
      activities: [{ action: "created", to: fields.stage }],
    });
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// List leads with optional stage/source/search filters and pagination.
// Returns { data, count, totalPages, currentPage }.
//
// `affiliate` may be a single id OR a comma-separated list of ids. The trusted
// admin proxy uses the list form for a master partner viewing their team's
// pipeline, and for the platform admin viewing leads across partners. It is
// still required on every request (defence in depth — no unscoped queries).
async function getLeads(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const { stage, source, search } = req.query;
    const pageInt = parseInt(req.query.page) || 1;
    const limitInt = parseInt(req.query.limit) || 20;
    const skip = (pageInt - 1) * limitInt;

    const affiliateIds = String(affiliate)
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "");
    if (affiliateIds.length === 0) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const filter =
      affiliateIds.length === 1
        ? { affiliate: affiliateIds[0] }
        : { affiliate: { $in: affiliateIds } };
    if (stage) filter.stage = stage;
    if (source) filter.source = source;
    if (search && String(search).trim() !== "") {
      const rx = new RegExp(String(search).trim(), "i");
      filter.$or = [
        { businessName: rx },
        { contactPerson: rx },
        { phonenumber: rx },
        { location: rx },
        { businessType: rx },
      ];
    }

    const [data, count] = await Promise.all([
      Lead.find(filter)
        .sort({ createAt: -1 })
        .skip(skip)
        .limit(limitInt)
        // Owner shown in team/admin views; only safe fields, never password/otp.
        .populate("affiliate", "name email phonenumber"),
      Lead.countDocuments(filter),
    ]);

    res.json({
      data,
      count,
      totalPages: Math.max(1, Math.ceil(count / limitInt)),
      currentPage: pageInt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Fetch one lead, scoped to the affiliate (404 if not theirs). Like getLeads,
// `affiliate` may be a comma-separated list — the trusted proxy uses that for a
// master partner opening a team member's lead and for the platform admin.
async function getLeadById(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const affiliateIds = String(affiliate)
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "");
    if (affiliateIds.length === 0) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const scope =
      affiliateIds.length === 1
        ? { affiliate: affiliateIds[0] }
        : { affiliate: { $in: affiliateIds } };
    const lead = await Lead.findOne({ _id: req.params.id, ...scope })
      // Owner shown in team/admin detail views; safe fields only.
      .populate("affiliate", "name email phonenumber");
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Update a lead, scoped to the affiliate. A partner can never reassign a lead to
// a different affiliate because the match includes their own affiliate id.
// Changes are recorded on the lead's activity timeline: stage moves and
// follow-up date changes get their own entries; any other field edit is logged
// as a single "details_updated" entry.
async function updateLead(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const updates = pickWritable(req.body || {});

    const lead = await Lead.findOne({ _id: req.params.id, affiliate });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const activities = [];
    if (
      Object.prototype.hasOwnProperty.call(updates, "stage") &&
      updates.stage !== lead.stage
    ) {
      activities.push({
        action: "stage_changed",
        from: lead.stage || "",
        to: updates.stage || "",
      });
    }
    if (Object.prototype.hasOwnProperty.call(updates, "nextFollowUpDate")) {
      const oldDate = lead.nextFollowUpDate
        ? new Date(lead.nextFollowUpDate).toISOString()
        : "";
      const newDate = updates.nextFollowUpDate
        ? new Date(updates.nextFollowUpDate).toISOString()
        : "";
      if (oldDate !== newDate) {
        activities.push({ action: "follow_up_set", from: oldDate, to: newDate });
      }
    }
    const detailFields = [
      "businessName",
      "contactPerson",
      "phonenumber",
      "businessType",
      "location",
      "source",
      "notes",
    ];
    const detailChanged = detailFields.some(
      (key) =>
        Object.prototype.hasOwnProperty.call(updates, key) &&
        String(updates[key] == null ? "" : updates[key]) !==
          String(lead[key] == null ? "" : lead[key])
    );
    if (detailChanged) {
      activities.push({ action: "details_updated" });
    }

    lead.set(updates);
    lead.updatedAt = Date.now();
    for (const activity of activities) lead.activities.push(activity);
    await lead.save();
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Append a free-text note to a lead's activity timeline (own leads only — the
// proxy always supplies the session partner's own affiliate id here).
async function addLeadActivity(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const note = req.body && typeof req.body.note === "string" ? req.body.note.trim() : "";
    if (!note) {
      return res.status(400).json({ message: "note is required" });
    }
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, affiliate },
      {
        $push: { activities: { action: "note", note } },
        $set: { updatedAt: Date.now() },
      },
      { new: true }
    );
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Delete a lead, scoped to the affiliate.
async function deleteLead(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, affiliate });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  addLeadActivity,
  deleteLead,
};
