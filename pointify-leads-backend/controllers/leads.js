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
    const lead = await Lead.create({ ...fields, affiliate });
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// List the affiliate's leads with optional stage/source/search filters and
// pagination. Returns { data, count, totalPages, currentPage }.
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

    const filter = { affiliate };
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
      Lead.find(filter).sort({ createAt: -1 }).skip(skip).limit(limitInt),
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

// Fetch one lead, scoped to the affiliate (404 if not theirs).
async function getLeadById(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const lead = await Lead.findOne({ _id: req.params.id, affiliate });
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
async function updateLead(req, res) {
  try {
    const affiliate = getAffiliate(req);
    if (!affiliate) {
      return res.status(400).json({ message: "affiliate is required" });
    }
    const updates = pickWritable(req.body || {});
    updates.updatedAt = Date.now();
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, affiliate },
      updates,
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
  deleteLead,
};
