/**
 * Shared affiliate (partner) commission crediting.
 *
 * Replaces the four copy-pasted award blocks in:
 *   - controllers/subscription.js (confirm payment + assign shops)
 *   - controllers/webhookController.js (Paystack webhook)
 *   - routes/mpesa.js (M-Pesa confirmation)
 *
 * What it does for every paid subscription:
 *   1. Resolves the commission percentage from the partner record that the
 *      admin configured (Affliate.commission) — no more hard-coded 20%.
 *   2. Keeps the volume bonus: when the partner network has more than
 *      `bonusThreshold` active production subscribers this month, the
 *      percentage is raised to `bonusCommission` (if higher than their own).
 *      Base/bonus/threshold live in the global Settings collection under
 *      "AFFILIATE_COMMISSION" so the platform admin can change them without a
 *      code deploy. Defaults: base 20, bonus 30, threshold 10.
 *   3. Splits the award when the referring partner is a SUB-partner:
 *      the total is computed with the MASTER's percentage, the sub receives
 *      `subCommission`% OF that total, and the master keeps the remainder.
 *      Both wallets are credited and both get an awards record + email + SMS.
 */

const Affliate = require("../models/affliate");
const Subscription = require("../models/subscription");
const Setting = require("../models/Setting");
const awardsSchema = require("../models/awards");
const functions = require("./functions");
const { sendEmailNew } = require("./emailsetup");

const SETTING_NAME = "AFFILIATE_COMMISSION";
const DEFAULTS = {
  baseCommission: 20,
  bonusCommission: 30,
  bonusThreshold: 10,
};

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Reads (and seeds on first use) the commission tier settings so they show up
 * in the platform admin's Settings page and can be edited there.
 */
async function getCommissionConfig() {
  let doc = await Setting.findOne({ name: SETTING_NAME });
  if (!doc) {
    try {
      doc = await Setting.create({ name: SETTING_NAME, setting: { ...DEFAULTS } });
    } catch (err) {
      // Another request may have seeded it concurrently — fall through to defaults.
      doc = await Setting.findOne({ name: SETTING_NAME });
    }
  }
  const s = (doc && doc.setting) || {};
  return {
    baseCommission: positiveNumber(s.baseCommission, DEFAULTS.baseCommission),
    bonusCommission: positiveNumber(s.bonusCommission, DEFAULTS.bonusCommission),
    bonusThreshold: positiveNumber(s.bonusThreshold, DEFAULTS.bonusThreshold),
  };
}

/**
 * Same volume rule as the old getAffiliateBonus, but counts the whole network:
 * distinct users with an active production subscription started this month
 * whose referring affiliate is any of `affiliateIds` (the master plus all of
 * their sub-partners), so sub-partner referrals also push the master's network
 * over the bonus threshold.
 */
async function countActiveNetworkUsers(affiliateIds) {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const ids = affiliateIds.map((id) => String(id));
  const subscriptions = await Subscription.find({
    type: "production",
    endDate: { $gt: currentDate },
    startDate: { $gte: startOfMonth, $lte: endOfMonth },
  })
    .populate({ path: "userId", select: "affliate" })
    .select("userId")
    .exec();

  const userIds = new Set();
  for (const sub of subscriptions) {
    const user = sub.userId;
    if (user && user.affliate && ids.includes(String(user.affliate))) {
      userIds.add(String(user._id));
    }
  }
  return userIds.size;
}

async function notifyPartner(partner, amount, balance, meta) {
  const { shopNames, subscriberName, currency } = meta;
  try {
    await sendEmailNew({
      recipientEmail: partner.email,
      recipientName: partner.name,
      subject: "New Earning",
      slug: "partneraward",
      placeholders: {
        referrerName: partner.name,
        shopName: shopNames || "",
        ownerName: subscriberName || "",
        points: amount,
        type: "subscription",
        currency: currency,
      },
    });
  } catch (err) {
    console.error("affiliateAward: email failed for", String(partner._id), err?.message);
  }
  try {
    if (partner.phonenumber) {
      functions.sendSms(
        partner.phonenumber,
        "Congratulations!! you have earned " +
          (currency || "KES") +
          " " +
          amount +
          (subscriberName ? " for " + subscriberName + " subscription" : " commission") +
          ", your new balance is " +
          (currency || "KES") +
          " " +
          balance
      );
    }
  } catch (err) {
    console.error("affiliateAward: sms failed for", String(partner._id), err?.message);
  }
}

/**
 * Credits the commission for one paid subscription.
 *
 * @param {Object} params
 * @param {string|Object} params.affiliateId  The referring affiliate (User.affliate) — master or sub.
 * @param {number} params.amount              The subscription amount paid.
 * @param {string} [params.mpesaCode]         Transaction code for the awards record / dedupe.
 * @param {Array}  [params.shops]             Shop ids for the awards record.
 * @param {string} [params.currency]          Currency label (defaults KES).
 * @param {string} [params.shopNames]         Human shop names for the notification email.
 * @param {string} [params.subscriberName]    The subscribing user's name for notifications.
 * @returns {Promise<{ totalAward: number, entries: Array<{affiliateId: string, amount: number, balance: number}> }>}
 *          totalAward is the full commission for this subscription (sub share +
 *          master share when split) — use it for Transaction.affliateAmount.
 */
async function creditAffiliateAward({
  affiliateId,
  amount,
  mpesaCode,
  shops,
  currency = "KES",
  shopNames = "",
  subscriberName = "",
}) {
  const empty = { totalAward: 0, entries: [] };
  try {
    if (Array.isArray(shopNames)) shopNames = shopNames.join(", ");
    if (!affiliateId || !(Number(amount) > 0)) return empty;

    const affiliate = await Affliate.findById(affiliateId);
    if (!affiliate) return empty;

    const cfg = await getCommissionConfig();

    // The percentage is anchored on the MASTER partner: for a sub-partner the
    // total is computed with the master's commission, then split.
    let master = null;
    if (affiliate.parent) {
      master = await Affliate.findById(affiliate.parent);
    }
    const anchor = master || affiliate;

    const children = await Affliate.find({ parent: anchor._id }).select("_id");
    const networkIds = [anchor._id, ...children.map((c) => c._id)];
    const networkCount = await countActiveNetworkUsers(networkIds);

    let pct = positiveNumber(anchor.commission, cfg.baseCommission);
    if (networkCount > cfg.bonusThreshold) {
      pct = Math.max(pct, cfg.bonusCommission);
    }

    const totalAward = round2((Number(amount) * pct) / 100);
    if (!(totalAward > 0)) return empty;

    // Work out who gets what.
    const payouts = [];
    if (master) {
      const rawSubPct = Number(affiliate.subCommission);
      const subPct = Number.isFinite(rawSubPct) ? Math.min(Math.max(rawSubPct, 0), 100) : 0;
      const subShare = round2((totalAward * subPct) / 100);
      const masterShare = round2(totalAward - subShare);
      if (subShare > 0) payouts.push({ partner: affiliate, amount: subShare });
      if (masterShare > 0) payouts.push({ partner: master, amount: masterShare });
    } else {
      payouts.push({ partner: affiliate, amount: totalAward });
    }

    const entries = [];
    for (const payout of payouts) {
      const balance = round2((payout.partner.wallet ?? 0) + payout.amount);
      await awardsSchema.create({
        type: "earnings",
        awardType: "subscription",
        shops: shops,
        user: payout.partner._id,
        affliate: payout.partner._id,
        totalAmount: payout.amount,
        mpesaCode: mpesaCode,
        balance: balance,
        currency: currency,
      });
      await Affliate.findByIdAndUpdate(payout.partner._id, { wallet: balance });
      await notifyPartner(payout.partner, payout.amount, balance, {
        shopNames,
        subscriberName,
        currency,
      });
      entries.push({
        affiliateId: String(payout.partner._id),
        amount: payout.amount,
        balance: balance,
      });
    }

    return { totalAward, entries };
  } catch (err) {
    // Never let commission crediting break subscription activation.
    console.error("affiliateAward: crediting failed:", err);
    return empty;
  }
}

module.exports = {
  creditAffiliateAward,
  getCommissionConfig,
  countActiveNetworkUsers,
  AFFILIATE_COMMISSION_SETTING: SETTING_NAME,
};
