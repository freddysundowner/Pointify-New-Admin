/**
 * Pointify POS — Platform Statistics aggregation
 * ------------------------------------------------------------------
 * Paste this into your Pointify POS API (the Node/Express/Mongoose app
 * that owns the database). The Pointify Admin proxy forwards
 *   GET /api/statistics  ->  GET /statistics  (this controller)
 * and the admin Statistics page renders whatever this returns.
 *
 * Mount it (e.g. in routes/statistics.js):
 *
 *   const express = require("express");
 *   const router = express.Router();
 *   const { getStatistics } = require("../controllers/statistics");
 *   router.get("/", getStatistics);          // -> GET /statistics
 *   module.exports = router;
 *
 *   // app.js
 *   app.use("/statistics", require("./routes/statistics"));
 *
 * Notes
 *  - All money figures are in KES (your Subscription/Shop currency default).
 *  - "revenue"  = platform income you earn from subscriptions (Subscription.amount).
 *  - "gmv"      = gross merchant sales across ALL shops (Sale.totalWithDiscount, cashed).
 *  - Period boundaries mirror your existing /subscriptions/summary/stats logic (UTC).
 *  - Field names match your models exactly: Subscription.createAt (no "d"),
 *    Shop.createAt (no "d"), Sale.createdAt, Admin.createdAt, SmsLog timestamps.
 */

const mongoose = require("mongoose");
const Subscription = require("../models/subscription");
const Sale = require("../models/sales");
const Admin = require("../models/admin");
const Shop = require("../models/shop");
const Product = require("../models/product");
const Package = require("../models/package");
const SmsLog = require("../models/smslog");

/* ------------------------------------------------------------------ */
/* Date helpers (UTC, consistent with /subscriptions/summary/stats)    */
/* ------------------------------------------------------------------ */

function getDateRange(period) {
  const now = new Date();
  let start = null;
  let end = null;

  switch (period) {
    case "today":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      end = null;
      break;
    case "yesterday":
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 1);
      break;
    case "thisWeek": {
      const day = now.getUTCDay();
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    }
    case "thisMonth":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      break;
    case "lastMonth":
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      break;
    case "thisYear":
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
      break;
    case "allTime":
    default:
      start = null;
      end = null;
      break;
  }
  return { start, end };
}

function rangeMatch(field, period) {
  const { start, end } = getDateRange(period);
  const m = {};
  if (start) m[field] = { $gte: start };
  if (end) m[field] = { ...(m[field] || {}), $lt: end };
  return m;
}

// Build a zero-filled list of the last `count` months: [{ key:"2026-06", label:"Jun" }]
function lastMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    out.push({ key, label });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

// Subscription revenue (amount) for one period. Mirrors getSubscriptionSummary.
async function subscriptionRevenue(period) {
  const rows = await Subscription.aggregate([
    { $match: rangeMatch("createAt", period) },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { amount: rows[0]?.amount || 0, count: rows[0]?.count || 0 };
}

// Gross merchant sales (cashed) for one period.
async function grossSales(period) {
  const rows = await Sale.aggregate([
    { $match: { status: "cashed", ...rangeMatch("createdAt", period) } },
    { $group: { _id: null, amount: { $sum: "$totalWithDiscount" }, count: { $sum: 1 } } },
  ]);
  return { amount: rows[0]?.amount || 0, count: rows[0]?.count || 0 };
}

// 12-month series for any model/field/value pair.
async function monthlySeries(model, dateField, valueField) {
  const months = lastMonths(12);
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1));
  const group = {
    _id: { y: { $year: `$${dateField}` }, m: { $month: `$${dateField}` } },
    count: { $sum: 1 },
  };
  if (valueField) group.amount = { $sum: `$${valueField}` };

  const match = { [dateField]: { $gte: start } };
  if (model === Sale) match.status = "cashed";

  const rows = await model.aggregate([{ $match: match }, { $group: group }]);
  const byKey = {};
  for (const r of rows) {
    const key = `${r._id.y}-${String(r._id.m).padStart(2, "0")}`;
    byKey[key] = r;
  }
  return months.map((mo) => ({
    month: mo.key,
    label: mo.label,
    count: byKey[mo.key]?.count || 0,
    amount: byKey[mo.key]?.amount || 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Main controller                                                     */
/* ------------------------------------------------------------------ */

async function getStatistics(req, res) {
  try {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      revToday,
      revYesterday,
      revThisWeek,
      revThisMonth,
      revLastMonth,
      revThisYear,
      revAllTime,
      gmvToday,
      gmvThisMonth,
      gmvAllTime,
      revenueTrend,
      salesTrend,
      userTrend,
      // counts
      totalUsers,
      newUsersThisMonth,
      newUsersToday,
      totalShops,
      newShopsThisMonth,
      totalProducts,
      // subscriptions
      subActive,
      subExpired,
      subExpiringSoon,
      subNewThisMonth,
      mrrRows,
      shopSubData,
      packageRows,
      topShopRows,
      smsThisMonth,
      smsAllTime,
    ] = await Promise.all([
      subscriptionRevenue("today"),
      subscriptionRevenue("yesterday"),
      subscriptionRevenue("thisWeek"),
      subscriptionRevenue("thisMonth"),
      subscriptionRevenue("lastMonth"),
      subscriptionRevenue("thisYear"),
      subscriptionRevenue("allTime"),
      grossSales("today"),
      grossSales("thisMonth"),
      grossSales("allTime"),
      monthlySeries(Subscription, "createAt", "amount"),
      monthlySeries(Sale, "createdAt", "totalWithDiscount"),
      monthlySeries(Admin, "createdAt", null),
      Admin.countDocuments({}),
      Admin.countDocuments(rangeMatch("createdAt", "thisMonth")),
      Admin.countDocuments(rangeMatch("createdAt", "today")),
      Shop.countDocuments({}),
      Shop.countDocuments(rangeMatch("createAt", "thisMonth")),
      Product.countDocuments({ deleted: { $ne: true } }),

      // Active = paid, not yet ended.
      Subscription.countDocuments({ paid: true, endDate: { $gte: now } }),
      // Expired = was paid but past endDate.
      Subscription.countDocuments({ paid: true, endDate: { $lt: now } }),
      // Expiring within 7 days (churn risk).
      Subscription.countDocuments({ paid: true, endDate: { $gte: now, $lt: in7days } }),
      Subscription.countDocuments(rangeMatch("createAt", "thisMonth")),

      // MRR-style run-rate: value of active PRODUCTION subscriptions.
      Subscription.aggregate([
        { $match: { paid: true, endDate: { $gte: now }, type: "production" } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),

      // Per-shop subscription status. Mirrors the authoritative
      // subscriptionStatistics() / GET /subscriptions/shop/stats method so these
      // numbers agree with the rest of the platform: a shop is "active" only when
      // its CURRENT subscription (Shop.subscription) is paid AND within its
      // start/end dates; classification is driven by the looked-up package.type
      // (trial | production), NOT the subscription.shops array.
      Shop.aggregate([
        { $match: { subscription: { $ne: null } } },
        {
          $lookup: {
            from: "subscriptions",
            localField: "subscription",
            foreignField: "_id",
            as: "subscription",
          },
        },
        { $unwind: "$subscription" },
        {
          $lookup: {
            from: "packages",
            localField: "subscription.packageId",
            foreignField: "_id",
            as: "package",
          },
        },
        { $unwind: "$package" },
        {
          $project: {
            adminId: "$adminId",
            type: "$package.type",
            isActive: {
              $and: [
                { $eq: ["$subscription.paid", true] },
                { $lte: ["$subscription.startDate", now] },
                { $gte: ["$subscription.endDate", now] },
              ],
            },
          },
        },
      ]),

      // Active subscriptions grouped by package: count + revenue.
      Subscription.aggregate([
        { $match: { paid: true, endDate: { $gte: now } } },
        { $group: { _id: "$packageId", activeSubscriptions: { $sum: 1 }, revenue: { $sum: "$amount" } } },
        { $sort: { activeSubscriptions: -1 } },
        {
          $lookup: { from: Package.collection.name, localField: "_id", foreignField: "_id", as: "pkg" },
        },
        { $unwind: { path: "$pkg", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ["$pkg.title", "Unknown"] },
            type: { $ifNull: ["$pkg.type", "unknown"] },
            activeSubscriptions: 1,
            revenue: 1,
          },
        },
      ]),

      // Top 5 shops by gross sales (cashed).
      Sale.aggregate([
        { $match: { status: "cashed" } },
        { $group: { _id: "$shopId", revenue: { $sum: "$totalWithDiscount" }, sales: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: Shop.collection.name, localField: "_id", foreignField: "_id", as: "shop" } },
        { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            shopId: "$_id",
            name: { $ifNull: ["$shop.name", "Unknown shop"] },
            revenue: 1,
            sales: 1,
          },
        },
      ]),

      // SMS this month: sent, failed, credits used.
      SmsLog.aggregate([
        { $match: rangeMatch("createdAt", "thisMonth") },
        {
          $group: {
            _id: null,
            sent: { $sum: 1 },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
            creditsUsed: { $sum: "$creditUsed" },
          },
        },
      ]),
      SmsLog.countDocuments({}),
    ]);

    // Derive shop + user status buckets from per-shop subscription data,
    // mirroring the authoritative subscriptionStatistics() method. A shop counts
    // as active only when its current subscription is paid and within dates; a
    // user (admin) is "paying" when ANY of their shops is active-production, else
    // "trial" when any is active-trial.
    const breakdown = {
      productionActive: 0,
      productionExpired: 0,
      trialActive: 0,
      trialExpired: 0,
    };
    const adminMap = new Map();
    for (const row of shopSubData) {
      const type = row.type === "production" ? "production" : "trial";
      if (row.isActive) breakdown[type + "Active"]++;
      else breakdown[type + "Expired"]++;

      const adminId = row.adminId ? row.adminId.toString() : null;
      if (!adminId) continue;
      if (!adminMap.has(adminId)) {
        adminMap.set(adminId, { activeProduction: false, activeTrial: false });
      }
      if (row.isActive) {
        const a = adminMap.get(adminId);
        if (type === "production") a.activeProduction = true;
        else a.activeTrial = true;
      }
    }
    let payingUsers = 0;
    let trialUsers = 0;
    for (const a of adminMap.values()) {
      if (a.activeProduction) payingUsers++;
      else if (a.activeTrial) trialUsers++;
    }

    const sms = smsThisMonth[0] || { sent: 0, failed: 0, creditsUsed: 0 };

    res.status(200).json({
      currency: "KES",
      generatedAt: now.toISOString(),

      revenue: {
        today: revToday,
        yesterday: revYesterday,
        thisWeek: revThisWeek,
        thisMonth: revThisMonth,
        lastMonth: revLastMonth,
        thisYear: revThisYear,
        allTime: revAllTime,
        mrr: mrrRows[0]?.amount || 0,
      },
      revenueTrend,

      gmv: {
        today: gmvToday,
        thisMonth: gmvThisMonth,
        allTime: gmvAllTime,
      },
      salesTrend,

      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        newToday: newUsersToday,
        paying: payingUsers,
        trial: trialUsers,
      },
      userTrend,

      shops: {
        total: totalShops,
        newThisMonth: newShopsThisMonth,
        productionActive: breakdown.productionActive,
        productionExpired: breakdown.productionExpired,
        trialActive: breakdown.trialActive,
        trialExpired: breakdown.trialExpired,
      },

      subscriptions: {
        active: subActive,
        expired: subExpired,
        expiringSoon: subExpiringSoon,
        newThisMonth: subNewThisMonth,
      },

      packages: packageRows,
      topShops: topShopRows,

      sms: {
        sentThisMonth: sms.sent,
        failedThisMonth: sms.failed,
        creditsUsedThisMonth: sms.creditsUsed,
        sentAllTime: smsAllTime,
      },

      catalog: {
        products: totalProducts,
      },
    });
  } catch (err) {
    console.error("getStatistics error:", err);
    res.status(500).json({ message: err.message || "Failed to build statistics" });
  }
}

module.exports = { getStatistics };
