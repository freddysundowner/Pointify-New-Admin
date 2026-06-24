const mongoose = require("mongoose");
const SaleItem = require("../models/saleitem");
const PurchaseItem = require("../models/purchaseitem");
const getProductPurchasesHistory = async (req, res) => { 
  try {
    const { id } = req.params;
    const { month, year, page = 1, limit = 10 } = req.query;

    if (!id || !month || !year) {
      return res.status(400).json({ error: "id, month, and year are required" });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const skip = (page - 1) * limit;

    const [purchaseItems, count] = await Promise.all([
      PurchaseItem.find({
        product: id,
        createdAt: { $gte: start, $lte: end },
      })
        .populate({
          path: "purchase",
          populate: { path: "supplierId", select: "name" },
          select: "createdAt purchaseNo paymentType",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

        PurchaseItem.countDocuments({
        product: id,
        createdAt: { $gte: start, $lte: end },
      }),
    ]);

    const data = purchaseItems.map((item) => ({
      receiptNo: item.purchase?.receiptNo || "N/A",
      supplier: item.purchase?.customerId?.name || "Direct",
      date: item.purchase?.createdAt,
      paymentType: item.purchase?.paymentType || "N/A",
      total: (item.unitPrice * item.quantity - (item.lineDiscount || 0)).toFixed(2),
      units: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
    }));

    res.status(200).json({
      data,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Sales history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
const getProductSalesHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year, page = 1, limit = 10 } = req.query;

    if (!id || !month || !year) {
      return res.status(400).json({ error: "id, month, and year are required" });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const skip = (page - 1) * limit;

    const [saleItems, count] = await Promise.all([
      SaleItem.find({
        product: id,
        createdAt: { $gte: start, $lte: end },
      })
        .populate({
          path: "sale",
          populate: { path: "customerId", select: "name" },
          select: "createdAt receiptNo paymentType",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      SaleItem.countDocuments({
        product: id,
        createdAt: { $gte: start, $lte: end },
      }),
    ]);

    const data = saleItems.map((item) => ({
      receiptNo: item.sale?.receiptNo || "N/A",
      customer: item.sale?.customerId?.name || "Walk-in",
      date: item.sale?.createdAt,
      paymentType: item.sale?.paymentType || "N/A",
      total: (item.unitPrice * item.quantity - (item.lineDiscount || 0)).toFixed(2),
      units: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
    }));

    res.status(200).json({
      data,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Sales history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getProductStockHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year, page = 1, limit = 10 } = req.query;

    if (!id || !month || !year) {
      return res.status(400).json({ error: "id, month, and year are required" });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const skip = (page - 1) * limit;

    const [purchaseItems, salesItems] = await Promise.all([
      PurchaseItem.find({ product: id, createdAt: { $gte: start, $lte: end } })
        .populate("attendantId", "username")
        .lean(),

      SaleItem.find({ product: id, createdAt: { $gte: start, $lte: end } })
        .populate("attendantId", "username")
        .lean(),
    ]);
    // Combine both as stock in/out
    const movements = [
      ...purchaseItems.map(item => ({
        type: "Stock In",
        description: "Product purchased",
        date: item.createdAt,
        performedBy: item.attendantId?.username || "Unknown",
        quantity: item.quantity,
      })),
      ...salesItems.map(item => ({
        type: "Stock Out",
        description: "Product sold",
        date: item.createdAt,
        performedBy: item.attendantId?.username || "Unknown",
        quantity: item.quantity,
      })),
    ];

    // Sort + Paginate manually
    const sorted = movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    const paged = sorted.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      data: paged,
      totalPages: Math.ceil(movements.length / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Stock history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getProductSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    if (!month || !year || !id) {
      return res.status(400).json({ error: "month, year, and id are required" });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const productObjectId = new mongoose.Types.ObjectId(id);

    // Total sales and units sold
    const [salesAgg = {}] = await SaleItem.aggregate([
      {
        $match: {
          product: productObjectId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: {
              $subtract: [
                { $multiply: ["$unitPrice", "$quantity"] },
                { $ifNull: ["$lineDiscount", 0] },
              ],
            },
          },
          totalUnitsSold: { $sum: "$quantity" },
        },
      },
    ]);

    // Total stock in
    const [purchaseAgg = {}] = await PurchaseItem.aggregate([
      {
        $match: {
          product: productObjectId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalStockIn: { $sum: "$quantity" },
        },
      },
    ]);

    const totalSales = salesAgg.totalSales || 0;
    const totalUnitsSold = salesAgg.totalUnitsSold || 0;
    const totalStockIn = purchaseAgg.totalStockIn || 0;
    const netMovement = totalStockIn - totalUnitsSold;

    return res.status(200).json({
      totalSales: +totalSales.toFixed(2),
      totalUnitsSold,
      totalStockIn,
      totalStockOut: totalUnitsSold,
      netMovement,
    });
  } catch (err) {
    console.error("Product summary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
module.exports = {
  getProductSalesHistory,
  getProductStockHistory,
  getProductSummary,getProductPurchasesHistory
};
