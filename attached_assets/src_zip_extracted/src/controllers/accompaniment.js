const Accompaniment = require("../models/accompaniment");

/**
 * GET /accompaniment/shop/:shopId
 * Returns all accompaniment configs for every product in a shop.
 * Used by the POS to pre-load all configs in one request.
 */
exports.getByShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const docs = await Accompaniment.find({ shopId }).lean();
    res.json(docs);
  } catch (err) {
    console.error("Get shop accompaniments error:", err);
    res.status(500).json({ error: "Failed to get accompaniments" });
  }
};

/**
 * GET /accompaniment/:productId?shopId=xxx
 * Returns the accompaniment config for a single product.
 */
exports.getByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { shopId } = req.query;

    const filter = { productId };
    if (shopId) filter.shopId = shopId;

    const doc = await Accompaniment.findOne(filter).lean();
    // Return empty groups array when nothing is configured yet
    res.json(doc || { productId, groups: [] });
  } catch (err) {
    console.error("Get accompaniment error:", err);
    res.status(500).json({ error: "Failed to get accompaniment" });
  }
};

/**
 * PUT /accompaniment/:productId
 * Body: { shopId, groups: [{ id, name, type, options: [{ id, name }] }] }
 * Creates or replaces the accompaniment config for a product.
 */
exports.upsert = async (req, res) => {
  try {
    const { productId } = req.params;
    const { shopId, groups } = req.body;

    if (!shopId) {
      return res.status(400).json({ error: "shopId is required" });
    }

    const doc = await Accompaniment.findOneAndUpdate(
      { productId, shopId },
      { productId, shopId, groups: groups || [] },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(doc);
  } catch (err) {
    console.error("Upsert accompaniment error:", err);
    res.status(500).json({ error: "Failed to save accompaniment" });
  }
};

/**
 * DELETE /accompaniment/:productId?shopId=xxx
 * Removes the accompaniment config for a product.
 */
exports.remove = async (req, res) => {
  try {
    const { productId } = req.params;
    const { shopId } = req.query;
    await Accompaniment.deleteOne({ productId, shopId });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete accompaniment error:", err);
    res.status(500).json({ error: "Failed to delete accompaniment" });
  }
};
