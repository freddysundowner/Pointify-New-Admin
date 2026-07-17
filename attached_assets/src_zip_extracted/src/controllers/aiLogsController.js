const mongoose = require("mongoose");

// ── AiInsightLog model ────────────────────────────────────────────────────────
// Reads from the same 'aiinsightlogs' collection written by the AI service.
// Uses mongoose.models check to avoid re-registering if already loaded.
const aiInsightLogSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },
        shopName: { type: String },
        ownerPhone: { type: String },
        insightType: { type: String },
        message: { type: String },
        smsSent: { type: Boolean, default: false },
        smsError: { type: String, default: null },
        stats: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

const AiInsightLog = mongoose.models.AiInsightLog ||
    mongoose.model("AiInsightLog", aiInsightLogSchema);

// ── GET /ai-logs ──────────────────────────────────────────────────────────────
// Paginated list of AI SMS messages sent to shop owners.
//
// Query params:
//   adminId   — filter by admin ObjectId
//   shopId    — filter by shop ObjectId
//   type      — filter by insightType (daily_summary, low_stock_alert, etc.)
//   sent      — filter by delivery status: true | false
//   from      — start date e.g. 2026-01-01
//   to        — end date   e.g. 2026-12-31
//   limit     — results per page (default 20, max 100)
//   page      — page number (default 1)
const getAiLogs = async (req, res) => {
    try {
        const {
            adminId,
            shopId,
            type,
            sent,
            from,
            to,
            limit = 20,
            page = 1,
        } = req.query;

        const filter = {};

        if (adminId) {
            if (!mongoose.Types.ObjectId.isValid(adminId)) {
                return res.status(400).json({ success: false, error: "Invalid adminId" });
            }
            filter.adminId = new mongoose.Types.ObjectId(adminId);
        }

        if (shopId) {
            if (!mongoose.Types.ObjectId.isValid(shopId)) {
                return res.status(400).json({ success: false, error: "Invalid shopId" });
            }
            filter.shopId = new mongoose.Types.ObjectId(shopId);
        }

        if (type) filter.insightType = type;
        if (sent !== undefined) filter.smsSent = sent === "true";

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (Math.max(parseInt(page), 1) - 1) * limitNum;

        const [logs, total] = await Promise.all([
            AiInsightLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            AiInsightLog.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            total,
            page: Math.max(parseInt(page), 1),
            pages: Math.ceil(total / limitNum),
            limit: limitNum,
            data: logs,
        });

    } catch (err) {
        console.error("getAiLogs error:", err.message);
        return res.status(500).json({ success: false, error: "Server error" });
    }
};

// ── GET /ai-logs/stats ────────────────────────────────────────────────────────
// Summary counts grouped by insightType.
//
// Query params:
//   adminId — filter by admin (optional)
//   from    — start date (optional)
//   to      — end date (optional)
const getAiLogStats = async (req, res) => {
    try {
        const { adminId, from, to } = req.query;

        const match = {};

        if (adminId) {
            if (!mongoose.Types.ObjectId.isValid(adminId)) {
                return res.status(400).json({ success: false, error: "Invalid adminId" });
            }
            match.adminId = new mongoose.Types.ObjectId(adminId);
        }

        if (from || to) {
            match.createdAt = {};
            if (from) match.createdAt.$gte = new Date(from);
            if (to) match.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const breakdown = await AiInsightLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$insightType",
                    total: { $sum: 1 },
                    sent: { $sum: { $cond: ["$smsSent", 1, 0] } },
                    failed: { $sum: { $cond: ["$smsSent", 0, 1] } },
                    lastSentAt: { $max: "$createdAt" },
                },
            },
            { $sort: { total: -1 } },
        ]);

        const totals = {
            total: breakdown.reduce((s, r) => s + r.total, 0),
            sent: breakdown.reduce((s, r) => s + r.sent, 0),
            failed: breakdown.reduce((s, r) => s + r.failed, 0),
        };

        return res.status(200).json({ success: true, totals, breakdown });

    } catch (err) {
        console.error("getAiLogStats error:", err.message);
        return res.status(500).json({ success: false, error: "Server error" });
    }
};

module.exports = { getAiLogs, getAiLogStats };