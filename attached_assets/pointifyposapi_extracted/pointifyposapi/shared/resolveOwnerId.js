const Shop = require("../models/shop");

const resolveOwnerId = async (doc) => {
  if (!doc) return null;

  if (doc.userId) return doc.userId.toString();
  if (doc.user) return doc.user.toString();
  if (doc.adminId) return doc.adminId.toString();
  if (doc.admin) return doc.admin.toString();

  if (doc.shop || doc.shopId) {
    const shopId = doc.shop || doc.shopId;
    const shop = await Shop.findById(shopId).lean();
    if (shop?.adminId) return shop.adminId.toString();
  }

  if (doc.fromShopId) {
    const shop = await Shop.findById(doc.fromShopId).lean();
    if (shop?.adminId) return shop.adminId.toString();
  }

  return null;
};

module.exports = resolveOwnerId;
