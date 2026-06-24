
const ExcelJS = require('exceljs');
const fs = require('fs');
const StockCount = require("../models/count");
const Product = require("../models/product");
const Inventory = require("../models/inventory")
const { Types } = require("mongoose");
const { fromDateFormat, toDateFormat } = require("../shared/validationUtils");
const ObjectId = Types.ObjectId;
exports.createStockCount = async (req, res) => {
  let { products, attendantId, shopId, useWarehouse = false } = req.body;
  console.log(req.body);
  try {
    if (useWarehouse == true) {
      const productsWithVariance = await Promise.all(
        products.map(async (productData) => {
          const product = await Inventory.findOne({product:productData.productId, shop: shopId});
          const initialCount = product.quantity;
          const variance = productData.physicalCount - initialCount;

          product.quantity = productData.physicalCount;
          product.lastCount = product.quantity;
          product.lastcoundate = new Date();
          product.save();
          return {
            productId: productData.productId,
            physicalCount: productData.physicalCount,
            variance,
            initialCount,
          };
        })
      );
        const stockCount = new StockCount({
          products: productsWithVariance,
          attendantId,
          shopId,
        });

        let response = await stockCount.save();
        res.json(response);
    } else{
      const productsWithVariance = await Promise.all(
        products.map(async (productData) => {
          const product = await Product.findById(productData.productId);
          if (!product) {
            throw new Error(
              `Product with ID ${productData.productId} not found.`
            );
          }
          // if (product.lastCount == productData.physicalCount) {
          //   return {
          //     error: "product already counted",
          //   };
          // } else {
          const initialCount = product.quantity;
          const variance = productData.physicalCount - initialCount;

          product.quantity += variance;
          product.lastCount = product.quantity;
          product.lastcoundate = new Date();
          product.save();
          return {
            productId: productData.productId,
            physicalCount: productData.physicalCount,
            variance,
            initialCount,
          };
          // }
        })
      );

      if (productsWithVariance[0]["error"] != null) {
        return res.status(500).json({ error: productsWithVariance["error"] });
      } else {
        const stockCount = new StockCount({
          products: productsWithVariance,
          attendantId,
          shopId,
        });

        let response = await stockCount.save();
        res.json(response);
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating stock count" });
  }
};

// Get a stock count entry by ID
exports.getStockCountById = async (req, res) => {
  try {
    const stockCount = await StockCount.findById(req.params.id);

    if (!stockCount) {
      return res.status(404).json({ error: "Stock count not found" });
    }

    res.status(200).json(stockCount);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error retrieving stock count" });
  }
};

// Delete a stock count entry by ID
exports.deleteStockCount = async (req, res) => {
  try {
    const stockCount = await StockCount.findByIdAndDelete(req.params.id);

    if (!stockCount) {
      return res.status(404).json({ error: "Stock count not found" });
    }

    res.status(200).json({ message: "Stock count deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error deleting stock count" });
  }
};
// Get stock counts by shopId
exports.getStockCountsByShopId = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const { fromDate,toDate ,attendantId} = req.query;
    let filter = { shopId };
    if (fromDate) {
      filter.createdAt = {
        $gte: fromDateFormat(fromDate),
        $lte: toDateFormat(toDate),
      };
    }
    if(attendantId){
      filter.attendantId = attendantId;
    }
    // Find stock counts that belong to the specified shopId
    const stockCounts = await StockCount.find(filter)
      .populate({
        path: "attendantId",
        select: "username",
      })
      .populate({
        path: "products",
        populate: {
          path: "productId",
          select: "name quantity buyingPrice sellingPrice",
        },
      })
      .sort({ createdAt: -1 });
      stockCounts.forEach((stockCount) => {
  stockCount.products.forEach((product) => {
    product.productId.buyingPrice = parseInt(product.productId.buyingPrice, 10);
  });
});
    // createPDFReport(filter);
    res.status(200).json(stockCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting stock counts by shopId" });
  }
};
// Get stock counts by productId
exports.getStockCountsByProductId = async (req, res) => {
  try {
    const productId = req.params.productId;
    const { shop } = req.query;
    let filter = {
      "products.productId": productId,
    };
    if (shop) {
      filter.shopId = shop
    }
    const stockCounts = await StockCount.find(filter).populate("attendantId", "username");

    res.status(200).json(stockCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting stock counts by productId" });
  }
};

// Get product counts by productId, year, and group by month names (including months with zero counts)
exports.getProductCountsByProductIdAndYear = async (req, res) => {
  try {
    const productId = req.params.productId;
    const {shop} = req.query;
    const year = parseInt(req.params.year);

    // Predefined array of all months with their names
    const allMonths = [
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

    // Use MongoDB aggregation to group counts by month number
    const result = await StockCount.aggregate([
      {
        $match: {
          "products.productId": new ObjectId(productId),
          "shopId": new ObjectId(shop),
        },
      },
      {
        $unwind: "$products", // Unwind the products array
      },
      {
        $match: {
          "products.createdAt": {
            $gte: new Date(year, 0),
            $lt: new Date(year + 1, 0),
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$products.createdAt" },
          },
          count: { $sum: 1 },
          variance: { $sum: "$products.variance" }, // Calculate total variance
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id.month",
          count: 1,
          variance: 1,
        },
      },
    ]);

    // Create an object to store counts for all months (including zero counts)
    const countsByMonth = {};
    const totalVariance = { total: 0 };

    allMonths.forEach((monthName, monthNumber) => {
      const data = result.find((data) => data.month === monthNumber + 1);
      countsByMonth[monthName] = data
        ? {
            count: data.count,
            variance: data.variance,
          }
        : { count: 0, variance: 0 };
      totalVariance.total += countsByMonth[monthName].variance;
    });

    res.status(200).json({ countsByMonth, totalVariance });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error getting product counts by productId and year" });
  }
};

exports.getProductsCountFilter = async (req, res) => {
  try {
    const { neverCounted, countedToday, notCountedToday } = req.query;
    const today = new Date(); // Get the current date

    let pipeline = [];

    if (neverCounted === "true") {
      // Filter products that have never been counted
      pipeline.push({
        $match: {
          "products.productId": { $exists: true },
        },
      });
    } else if (countedToday === "true") {
      // Filter products that have been counted today only
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      pipeline.push({
        $match: {
          "products.createdAt": {
            $gte: todayStart,
            $lt: todayEnd,
          },
        },
      });
    } else if (notCountedToday === "true") {
      // Filter products that have not been counted today only
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      pipeline.push({
        $match: {
          $or: [
            { "products.createdAt": { $lt: todayStart } },
            { "products.createdAt": { $gte: todayEnd } },
          ],
        },
      });
    }

    // Project the product IDs after filtering
    pipeline.push({
      $project: {
        productIds: "$products.productId",
      },
    });

    // Unwind the product IDs array
    pipeline.push({
      $unwind: "$productIds",
    });

    // Group the product IDs for filtering
    pipeline.push({
      $group: {
        _id: null,
        productIds: { $addToSet: "$productIds" },
      },
    });


    const result = await StockCount.aggregate(pipeline);

    const productIds = result.length > 0 ? result[0].productIds : [];

    const filteredProducts = await Product.find({
      deleted: false,
      _id: { $in: productIds },
    });

    res.status(200).json(filteredProducts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// Controller method to get the count of products counted by name
exports.getCountByProductName = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "Product name is required." });
    }

    // Search for product data by name using regex
    const products = await StockCount.find({
      products: {
        $elemMatch: {
          name: {
            $regex: new RegExp(name, "i"), // Use the provided name as a regex pattern (case-insensitive)
          },
        },
      },
    });
    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
async function createPDFReport(filter) {
  console.log("createPDFReport",filter)
 try {
    // Fetch stock counts from the database
    const stockCounts = await StockCount.find(filter)
      .populate({
        path: "attendantId",
        select: "username",
      })
      .populate({
        path: "products",
        populate: {
          path: "productId",
          select: "name quantity buyingPrice sellingPrice",
        },
      })
      .sort({ createdAt: -1 });
   console.log(stockCounts.length)

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Report');

    // Define table headers
    const headers = [ 'Product', 'InitialCount', 'physicalCount', 'variance'];

    // Add headers to the worksheet
    worksheet.addRow(headers);

    // Set column widths
    worksheet.columns = [
      { header: 'Product', key: 'product', width: 30 },
      { header: 'InitialCount', key: 'InitialCount', width: 15 },
      { header: 'physicalCount', key: 'physicalCount', width: 15 },
      { header: 'variance', key: 'variance', width: 15 }
    ];

   // Add rows to the worksheet
   let counts = [];
    stockCounts.forEach((count) => {
      count.products.forEach((product) => {
        const { initialCount, physicalCount,variance } = product;
        const { name} = product.productId;
        counts.push({name, initialCount, physicalCount,variance })
      }); 
    });
   console.log(counts.length);
    counts.forEach((count) => {
     let {name, initialCount, physicalCount,variance } = count;
      worksheet.addRow([name, initialCount, physicalCount, variance]);
    });

    // Write the workbook to a file
    await workbook.xlsx.writeFile('stock_report.xlsx');
    console.log('Excel report created successfully');
  } catch (error) {
    console.error('Error creating Excel report:', error);
  }
}
