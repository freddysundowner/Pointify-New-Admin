// controllers/badStockController.js
const BadStock = require("../models/badstock");
const Product = require("../models/product");
const mongoose = require("mongoose");
const Inventory = require("../models/inventory")
exports.deleteBadStock = async (req, res) => {
  let {id} = req.params
  let bstock = await BadStock.findByIdAndRemove(id);
  const product = await Inventory.findOneAndUpdate(
    { product: bstock.productId, shop: bstock.shopId },
    {
      $inc: {
        quantity: bstock.quantity,
      },
    },
  );
  return res.json({ success: true});
}
// Create bad stock entry
exports.createBadStock = async (req, res) => {
  try {
    // Extract and validate data from the request body
    const { productId, shopId, attendantId, quantity, reason, unitPrice, useWarehouse = false  } =
      req.body;
    console.log(req.body)
    // Create a new bad stock entry
    const badStock = new BadStock({
      productId,
      shopId,
      attendantId,
      quantity,
      unitPrice,
      reason,
    });

    if (useWarehouse == true) {
      // Update the product quantity
      const product = await Inventory.findOne({product: productId, shop : shopId});
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Reduce the product quantity by the bad stock quantity
      product.quantity -= quantity;
      await product.save();
    } else {
      // Update the product quantity
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Reduce the product quantity by the bad stock quantity
      product.quantity -= quantity;
      await product.save();
    }
      // Save the bad stock entry to the database
      const result = await badStock.save();

      res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating bad stock entry" });
  }
};
exports.getBadStockSummaries = async (req, res) => {
  try {
    const { shopId, startDate, endDate, attendantId } = req.query;
    const matchStage = {};

    // Optional date filtering
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000);
      matchStage.createdAt = { $gte: start, $lt: end };
    }

    // Optional shop filtering
    if (shopId) {
      matchStage.shopId = new mongoose.Types.ObjectId(shopId);
    }

    const summary = await BadStock.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
        },
      },
    ]);


    res.json({
      summary: summary[0] || {
        totalEntries: 0,
        totalQuantity: 0,
        totalValue: 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error generating summary report" });
  }
};
exports.getBadStock = async (req, res) => {
  try {
    const { shopId, attendantId, product, startDate, endDate, page, limit } = req.query;
    const query = {};

    // Filter by date range
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      query.createdAt = {
        $gte: startDateObj,
        $lt: new Date(endDateObj.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    // Optional filters
    if (shopId) {
      query.shopId = shopId;
    }
    if (attendantId) {
      query.attendantId = attendantId;
    }
    if (product) {
      query.productId = new mongoose.Types.ObjectId(product);
    }

    // Pagination condition
    if (page) {
      const pageNum = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * pageSize;

      const totalCount = await BadStock.countDocuments(query);
      const badStockEntries = await BadStock.find(query)
        .populate("attendantId", "username")
        .populate("shopId", "name")
        .populate("productId", "name buyingPrice")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

      return res.json({
        data: badStockEntries,
        totalCount,
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / pageSize),
      });
    }

    // No pagination – return all results
    const badStockEntries = await BadStock.find(query)
      .populate("attendantId", "username")
      .populate("shopId", "name")
      .populate("productId", "name buyingPrice")
      .sort({ createdAt: -1 });

    res.json(badStockEntries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching bad stock entries" });
  }
};

exports.getBadStockSummary = async (req, res) => {
  try {
    const { year, product, shop } = req.query;

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31T23:59:59.999`);

    const matchQuery = {
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };

    if (product) {
      matchQuery.productId = new mongoose.Types.ObjectId(product);
    }
    if (shop) {
      matchQuery.shopId = new mongoose.Types.ObjectId(shop);
    }

    const summary = await BadStock.aggregate([
      {
        $match: matchQuery,
      },
      {
        $lookup: {
          from: "products", // Replace with the actual name of the Products collection
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $group: {
          _id: {
            month: {
              $dateToString: {
                format: "%Y-%m",
                date: "$createdAt",
              },
            },
          },
          count: { $sum: "$quantity" },
          totalLost: {
            $sum: { $multiply: ["$unitPrice", "$quantity"] },
          },
        },
      },
      {
        $sort: {
          "_id.month": 1,
        },
      },
    ]);

    const result = [];
    const yearTotal = { count: 0, totalLost: 0 };
    const startDateMonth = startDate.getMonth();
    const endDateMonth = endDate.getMonth();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    for (let month = startDateMonth; month <= endDateMonth; month++) {
      const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
      const matchingSummary = summary.find(
        (item) => item._id.month === yearMonth
      );
      const count = matchingSummary ? matchingSummary.count : 0;
      const totalLost = matchingSummary ? matchingSummary.totalLost : 0;

      yearTotal.count += count;
      yearTotal.totalLost += totalLost;

      result.push({
        month: monthNames[month],
        year: year,
        count,
        totalLost,
      });
    }

    res.status(200).json({ result, yearTotal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// Controller method to get bad products by date
exports.getBadProductsByDate = async (req, res) => {
  try {
    const { startDate, endDate, shopId } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required." });
    }
    // Convert the start and end dates to valid JavaScript Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    let query = {
      createdAt: {
        $gte: startDateObj, // Greater than or equal to the start date
        $lt: new Date(endDateObj.getTime() + 24 * 60 * 60 * 1000), // Less than the day after the end date
      },
    };
    if (shopId) {
      query.shopId = shopId;
    }

    // Search for bad products within the specified date range
    const badProducts = await BadStock.find(query)
      .populate({ path: "productId", select: "name buyingPrice" })
      .populate({ path: "shopId", select: "name" })
      .populate({ path: "attendantId", select: "username" });

    res.status(200).json(badProducts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
