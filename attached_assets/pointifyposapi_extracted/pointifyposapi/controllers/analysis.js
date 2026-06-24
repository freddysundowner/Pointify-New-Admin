const Product = require("../models/product");
const BadStock = require("../models/badstock");
const Inventory = require("../models/inventory")
const Sale = require("../models/sales")
const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");
const mongoose = require("mongoose");
const Expenses = require("../models/expenses");
const purchase = require("../models/purchase");
const sales = require("../models/sales");
const { generateBackup } = require("../shared/clonjob");
const Attendant = require("../models/attendant");
const Admin = require("../models/admin");  
const ExcelJS = require('exceljs');
const StockCount = require("../models/count");
const SaleReturn = require("../models/salereturns");
const UserPayment = require("../models/payment");


const salesReport = async (req, res) => {
  try {
    const { fromDate, toDate, shopid, attendantId } = req.query;

    /* ===============================
       BASE MATCH
    =============================== */
    const saleMatch = {
      shopId: new mongoose.Types.ObjectId(shopid),
    };

    if (fromDate || toDate) {
      saleMatch.createdAt = {};
      if (fromDate) saleMatch.createdAt.$gte = fromDateFormat(fromDate);
      if (toDate) saleMatch.createdAt.$lte = toDateFormat(toDate);
    }

    if (attendantId) {
      saleMatch.attendantId = new mongoose.Types.ObjectId(attendantId);
    }

    /* =====================================================
       1️⃣ SALES SUMMARY + OUTER CHANNELS + CREDIT BALANCE
       (NO payments[] USED HERE)
    ===================================================== */
    console.log(saleMatch); 
    const [summary] = await Sale.aggregate([
      { $match: saleMatch },

      {
        $group: {
          _id: null,

          /* ---------- TOTAL SALES (CASH + CREDIT) ---------- */
          totalSales: {
            $sum: {
              $cond: [
                { $eq: ["$status", "cashed"] },
                "$totalWithDiscount",
                0,
              ],
            },
          },

          /* ---------- OUTER CHANNELS (NON-CREDIT ONLY) ---------- */
          cashtransactions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "cashed"] },
                    { $ne: ["$paymentType", "credit"] },
                  ],
                },
                {
                  $cond: [
                    { $eq: ["$paymentTag", "split"] },
                    "$amountPaid",              // cash part of split
                    {
                      $cond: [
                        { $eq: ["$paymentType", "cash"] },
                        "$totalWithDiscount",
                        0,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
          cash: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "cashed"] },
                    { $eq: ["$paymentType", "cash"] },
                  ],
                },
                {
                  $cond: [
                    { $eq: ["$paymentTag", "split"] },
                    "$amountPaid",              // cash part of split
                    {
                      $cond: [
                        { $eq: ["$paymentType", "cash"] },
                        "$totalWithDiscount",
                        0,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },


          mpesa: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "cashed"] },
                    { $ne: ["$paymentType", "credit"] },
                  ],
                },
                {
                  $cond: [
                    { $eq: ["$paymentTag", "split"] },
                    "$mpesaNewTotal",
                    {
                      $cond: [
                        { $eq: ["$paymentType", "mpesa"] },
                        "$totalWithDiscount",
                        0,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },


          bank: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "cashed"] },
                    { $ne: ["$paymentType", "credit"] },
                  ],
                },
                {
                  $cond: [
                    { $eq: ["$paymentTag", "split"] },
                    "$bankTotal",
                    {
                      $cond: [
                        { $eq: ["$paymentType", "bank"] },
                        "$totalWithDiscount",
                        0,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },


          wallet: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "cashed"] },
                    { $ne: ["$paymentType", "credit"] },
                  ],
                },
                {
                  $cond: [
                    { $eq: ["$paymentTag", "split"] },
                    "$walletTotal",
                    {
                      $cond: [
                        { $eq: ["$paymentType", "wallet"] },
                        "$totalWithDiscount",
                        0,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },


          /* ---------- OUTSTANDING CREDIT ---------- */
          credit: {
            $sum: {
              $cond: [
                { $eq: ["$paymentType", "credit"] },
                "$totalWithDiscount",
                0,
              ],
            },
          },

          /* ---------- HOLD ---------- */
          hold: {
            $sum: {
              $cond: [
                { $eq: ["$status", "hold"] },
                "$totalWithDiscount",
                0,
              ],
            },
          },
        },
      },
    ]);

    /* =====================================================
       2️⃣ CREDIT COLLECTIONS (payments[] INSIDE CREDIT SALES)
    ===================================================== */
    const [debtPaid] = await Sale.aggregate([
      {
        $match: {
          ...saleMatch,
          paymentType: "credit",
        },
      },
      { $unwind: "$payments" },

      ...(fromDate || toDate
        ? [
          {
            $match: {
              "payments.date": {
                ...(fromDate && { $gte: fromDateFormat(fromDate) }),
                ...(toDate && { $lte: toDateFormat(toDate) }),
              },
            },
          },
        ]
        : []),

      {
        $group: {
          _id: null,

          debtpaid: { $sum: "$payments.amount" },

          cash: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$payments.paymentType" }, "cash"] },
                "$payments.amount",
                0,
              ],
            },
          },


          mpesa: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$payments.paymentType" }, "mpesa"] },
                "$payments.amount",
                0,
              ],
            },
          },


          bank: {
            $sum: {
              $cond: [
                { $eq: ["$payments.paymentType", "bank"] },
                "$payments.amount",
                0,
              ],
            },
          },

          wallet: {
            $sum: {
              $cond: [
                { $eq: ["$payments.paymentType", "wallet"] },
                "$payments.amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    /* =====================================================
       3️⃣ RETURNS
    ===================================================== */
    const [returns] = await SaleReturn.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          totalRefundAmount: { $sum: "$refundAmount" },
        },
      },
    ]);

    /* =====================================================
       4️⃣ FINAL RESPONSE
    ===================================================== */
    const data = {
      totalSales: summary?.totalSales || 0,

      total_at_hand: (summary?.cash || 0) + (summary?.mpesa || 0) + (summary?.bank || 0) + (summary?.wallet || 0),
      mpesa: summary?.mpesa || 0,
      bank: summary?.bank || 0,
      wallet: summary?.wallet || 0,

      cash:
        (summary?.cash || 0) + (summary?.mpesa || 0) + (summary?.bank || 0) + (summary?.wallet || 0) ,
      cash_sales: summary?.cash || 0,

      credit: summary?.credit || 0,

      debtpaid: debtPaid?.debtpaid || 0,
      debtpaid_breakdown: {
        cash: debtPaid?.cash || 0,
        mpesa: debtPaid?.mpesa || 0,
        bank: debtPaid?.bank || 0,
        wallet: debtPaid?.wallet || 0,
      },

      hold: summary?.hold || 0,
      returns: returns?.totalRefundAmount || 0,
    }; 

    res.status(200).json(data);
  } catch (error) {
    console.error("Sales report error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const getOutOfStockProductsExcel = async (req, res) => {
  try {
    let { shopid, warehouse = "true" } = req.query;
    let outOfStockProducts = [];

    if (warehouse == "true") {
      outOfStockProducts = await Inventory.aggregate([
        {
          $match: {
            shop: new ObjectId(shopid),
            quantity: { $lte: 0 }
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $project: {
            name: "$productDetails.name",
            quantity: 1
          }
        }
      ]);
    } else {
      outOfStockProducts = await Product.find({
        shopId: shopid,
        quantity: { $lte: 0 },
        deleted: false
      }).select('name quantity');
    }

    // Create workbook & sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Out of Stock');

    // Title & date
    worksheet.mergeCells('A1', 'C1');
    worksheet.getCell('A1').value = 'Out of Stock Products Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A2').value = `Generated on: ${new Date().toLocaleString()}`;
    worksheet.getCell('A2').font = { size: 10 };

    // Add header row
    worksheet.addRow([]);
    const header = worksheet.addRow(['Product Name', 'Quantity']);
    header.font = { bold: true };

    // Add data rows
    outOfStockProducts.forEach(prod => {
      worksheet.addRow([prod.name, prod.quantity]);
    });

    // Total summary
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([`Total out of stock products:`, outOfStockProducts.length]);
    totalRow.font = { bold: true };

    // Adjust column widths
    worksheet.columns.forEach(column => {
      let maxLength = 15;
      column.eachCell({ includeEmpty: true }, cell => {
        maxLength = Math.max(maxLength, cell.value ? cell.value.toString().length : 0);
      });
      column.width = maxLength + 2;
    });

    // Set response headers to prompt download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=out_of_stock_products.xlsx'
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Failed to generate out-of-stock Excel:", error);
    res.status(500).json({ error: "Internal server error generating Excel" });
  }
};



// Controller method to calculate total stock value and profit estimate
const calculateStockValue = async (req, res) => {
  try {
  let { shopid, warehouse = "true" } = req.query;
  if (warehouse == "true") {
    const totalStockValue = await Inventory.aggregate([
      {
        $match: {
          shop: new ObjectId(req.query.shopid),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails", // Flatten the productDetails array
      },
      {
        $lookup: {
          from: "batches",
          localField: "batches",
          foreignField: "_id",
          as: "batches",
        },
      },
      {
        $project: {
          stockValue: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ["$batches", []] } }, 0] },
              then: {
                $sum: {
                  $map: {
                    input: "$batches",
                    as: "batch",
                    in: {
                      $multiply: [
                        { $ifNull: ["$$batch.buyingPrice", 0] },
                        { $ifNull: ["$$batch.quantity", 0] },
                      ],
                    },
                  },
                },
              },
              else: {
                $multiply: [
                  { $ifNull: ["$productDetails.buyingPrice", 0] },
                  { $ifNull: ["$quantity", 0] }, // Quantity from Inventory
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$stockValue" },
        },
      },
      {
        $project: {
          _id: 0,
          totalValue: 1,
        },
      },
    ]);

    const profitEstimate = await Inventory.aggregate([
      {
        $match: {
          shop: new ObjectId(req.query.shopid),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
      {
        $lookup: {
          from: "batches",
          localField: "batches",
          foreignField: "_id",
          as: "batches",
        },
      },
      {
        $project: {
          hasBatches: { $gt: [{ $size: { $ifNull: ["$batches", []] } }, 0] },
          profit: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ["$batches", []] } }, 0] },
              then: {
                $sum: {
                  $map: {
                    input: "$batches",
                    as: "batch",
                    in: {
                      $multiply: [
                        {
                          $subtract: [
                            "$productDetails.sellingPrice",
                            "$$batch.buyingPrice",
                          ],
                        },
                        { $ifNull: ["$$batch.quantity", 0] },
                      ],
                    },
                  },
                },
              },
              else: {
                $multiply: [
                  {
                    $subtract: [
                      "$productDetails.sellingPrice",
                      "$productDetails.buyingPrice",
                    ],
                  },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$profit" },
        },
      },
      {
        $project: {
          _id: 0,
          totalProfit: 1,
        },
      },
    ]);
    const outofstock = await Inventory.countDocuments({quantity: {$lte : 0},shop:shopid})
    const totalstock = await Inventory.countDocuments({shop:shopid})
    const lowstock = await Inventory.countDocuments({$expr: { $lte: ["$quantity", "$reorderLevel"] },shop:shopid,reorderLevel: { $ne: 0 }})
    res.status(200).json({
      totalStockValue:
        totalStockValue.length == 0 ? 0 : totalStockValue[0].totalValue || 0,
      profitEstimate:
        profitEstimate.length == 0 ? 0 : profitEstimate[0].totalProfit || 0,
        outofstock,lowstock,totalstock
    });

  } else {
    // Calculate total stock value
    const totalStockValue = await Product.aggregate([
      {
        $match: {
          deleted: false,
          shopId: new ObjectId(req.query.shopid),
        },
      },
      {
        $lookup: {
          from: "batches",
          localField: "batches",
          foreignField: "_id",
          as: "batches",
        },
      },
      {
        $project: {
          stockValue: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ["$batches", []] } }, 0] },
              then: {
                $sum: {
                  $map: {
                    input: "$batches",
                    as: "batch",
                    in: {
                      $multiply: [
                        { $ifNull: ["$$batch.buyingPrice", 0] },
                        { $ifNull: ["$$batch.quantity", 0] },
                      ],
                    },
                  },
                },
              },
              else: {
                $multiply: [
                  { $ifNull: ["$buyingPrice", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$stockValue" },
        },
      },
      {
        $project: {
          _id: 0, // Exclude the _id field
          totalValue: 1,
        },
      },
    ]);
    const totalstock = await Product.countDocuments({shopId:shopid})

    const profitEstimate = await Product.aggregate([
      {
        $match: {
          deleted: false,
          shopId: { $eq: new ObjectId(req.query.shopid) },
        },
      },
      {
        $lookup: {
          from: "batches",
          localField: "batches",
          foreignField: "_id",
          as: "batches",
        },
      },
      {
        $project: {
          hasBatches: { $gt: [{ $size: { $ifNull: ["$batches", []] } }, 0] },
          profit: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ["$batches", []] } }, 0] }, // Check if populated batches exist
              then: {
                $sum: {
                  $map: {
                    input: "$batches",
                    as: "batch",
                    in: {
                      $multiply: [
                        { $subtract: ["$sellingPrice", "$$batch.buyingPrice"] }, // Use sellingPrice from Product and buyingPrice from each batch
                        { $ifNull: ["$$batch.quantity", 0] }, // Quantity from each batch
                      ],
                    },
                  },
                },
              },
              else: {
                $multiply: [
                  { $subtract: ["$sellingPrice", "$buyingPrice"] }, // Use both sellingPrice and buyingPrice from Product
                  { $ifNull: ["$quantity", 0] }, // Quantity from Product
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$profit" },
        },
      },
      {
        $project: {
          _id: 0, // Exclude the _id field
          totalProfit: 1,
        },
      },
    ]);
    const outofstock = await Product.countDocuments({quantity: {$lte : 0}, shopId: shopid})
    const lowstock = await Product.countDocuments({$expr: { $lte: ["$quantity", "$reorderLevel"] },shopId:shopid})
    res.status(200).json({
      totalStockValue:
        totalStockValue.length == 0 ? 0 : totalStockValue[0].totalValue || 0,
      profitEstimate:
        profitEstimate.length == 0 ? 0 : profitEstimate[0].totalProfit || 0,
        outofstock,lowstock,totalstock
    });
  }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const profitSummary = async (req, res) => {
  try {
    const { fromDate, toDate, shopid, attendant } = req.query
    let filter = {
    
        createdAt: { $gte: fromDateFormat(fromDate), $lte: toDateFormat(toDate) },
        shopId: new ObjectId(shopid),
    }
    const totalProfitAndSalesValue = await calculateTotalProfitOnSales(
      fromDateFormat(fromDate),
      toDateFormat(toDate),
      shopid,
      attendant
    );
    const totalExpensesValue = await calculateTotalExpenses(
      fromDateFormat(fromDate),
      toDateFormat(toDate),
      shopid
    );
    let salestotal = totalProfitAndSalesValue.totalSales;
    res.status(200).json({
      purchases:totalProfitAndSalesValue.totalPurchases,
      sales:salestotal,
      gross: totalProfitAndSalesValue.totalProfit,
      totalProfitAndSalesValue,
      netprofit: totalProfitAndSalesValue.totalProfit - totalExpensesValue.totalExpenses
    });
  } catch (error) {
    console.error("Failed to calculate financial data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getCreditTotalSales = async (
  fromDate,
  toDate,
  shopId) => {
  let filter = {
    createdAt: {
      $gte: fromDate,
      $lte: toDate,
    },
    status: "cashed",
    shopId: new mongoose.Types.ObjectId(shopId),
    paymentType: "credit"
  }
  
  try {
    const result = await sales.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          totalOutstandingBalance: {
            $sum: { $subtract: ["$totalWithDiscount", "$amountPaid"] },
          },
        },
      },
    ]);

    return result.length == 0 ? 0 : result[0].totalOutstandingBalance;
  } catch (error) {
    console.error('Error aggregating outstandingBalance:', error);
  }

}
const calculateetProfit = async (req, res) => {
  try {
    const { fromDate, toDate, shopId, attendant } = req.query;
    const endOfDay = toDateFormat(toDate);
    // Calculate total profit on sales
    const totalProfitAndSalesValue = await calculateTotalProfitOnSales(
        new Date(fromDate),
      new Date(endOfDay),
      shopId,
      attendant
    );

    const creditTotals = await getCreditTotalSales( new Date(fromDate),
      new Date(endOfDay),shopId);
  
    // Calculate the total value of bad stock
    const badStockValueAmount = await calculateBadStockValue(
      new Date(fromDate),
      endOfDay,
      shopId
    ); 

    const totalExpensesValue = await calculateTotalExpenses(
      new Date(fromDate),
      endOfDay,
      shopId
    );
    let salesDebtPaidRepose = await debtPaid(new Date(fromDate), new Date(endOfDay), shopId,"sales");

    res.status(200).json({
      creditTotals,
      debtPaid : salesDebtPaidRepose.length >0 ? salesDebtPaidRepose[0].amountPaid : 0,
      totalProfitAndSalesValue,
      badStockValue: badStockValueAmount,
      totalExpenses: totalExpensesValue,
      totalTaxes: totalProfitAndSalesValue.totalTaxes,
      gross: totalProfitAndSalesValue.totalProfit,
      net: totalProfitAndSalesValue.totalProfit - totalExpensesValue.totalExpenses - totalProfitAndSalesValue.totalTaxes,
    });
  } catch (error) {
    console.error("Failed to calculate financial data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
debtPaid = async (fromDate, toDate, shopid,type) => {
  let filter = {
  $match: {
    createdAt: {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setUTCHours(23, 59, 59, 999)),
    },
    type: "payment",
    shopId: new mongoose.Types.ObjectId(shopid),
  }
};

if (type === "sales") { 
  filter.$match.customerId = {
    $ne: null
  };
}

if (type === "purchases") { 
  filter.$match.supplierId = {
    $ne: null
  };
}

const salesDebtPaid = await UserPayment.aggregate([
  filter,
  {
    $group: {
      _id: null,
      amountPaid: { $sum: '$totalAmount' },
    },
  },
]);
return salesDebtPaid;

}
const calculateTotalProfitOnSales = async (
  fromDate,
  toDate,
  shopId,
  attendantId
) => {
  const filter = {
  createdAt: {
    $gte: fromDate,
    $lte: toDate,
  },
  status: "cashed",
  shopId: new mongoose.Types.ObjectId(shopId),
};

if (attendantId) {
  filter.attendantId = new mongoose.Types.ObjectId(attendantId);
}

try {

  
 const result = await Sale.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: "saleitems",
        localField: "items",
        foreignField: "_id",
        as: "saleItems",
      },
    },
    {
      $unwind: {
        path: "$saleItems",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "saleItems.product",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    {
      $unwind: {
        path: "$productDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "batches",
        localField: "saleItems.batch",
        foreignField: "_id",
        as: "batchDetails",
      },
    },
    {
      $unwind: {
        path: "$batchDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        isCashPayment: { $cond: [{ $eq: ["$paymentType", "cash"] }, 1, 0] },
        effectiveBuyingPrice: {
  $ifNull: [
    "$saleItems.unitBuyingPrice",
    {
      $ifNull: [
        "$batchDetails.buyingPrice",
        "$productDetails.buyingPrice"
      ]
    }
  ]
},
        // effectiveBuyingPrice: {
        //   $cond: [
        //     { $ne: ["$batchDetails", null] },  // Check if batch exists
        //     { $ifNull: ["$batchDetails.buyingPrice", "$productDetails.buyingPrice"] }, // Use batch price or fallback to product price
        //     "$productDetails.buyingPrice"  // No batch case, use product buying price
        //   ]
        // }
      },
    },
    {
      $group: {
        _id: "$_id",
        sale: { $first: "$$ROOT" },
        totalSales: { $first: "$totalWithDiscount" },
        totalTaxes: { $first: "$totaltax" },
        totalPurchases: {
          $sum: {
            $multiply: [
              { $ifNull: ["$effectiveBuyingPrice", 0] }, // Effective buying price (batch or product)
              { $ifNull: ["$saleItems.quantity", 0] }    // Quantity sold
            ],
          },
        },
        totalProfit: {
          $sum: {
            $cond: [
              "$saleItems.manageByPrice",

              // price-managed products
              {
                $subtract: [
                  "$saleItems.unitPrice",
                  {
                    $multiply: [
                      "$effectiveBuyingPrice",
                      "$saleItems.quantity"
                    ]
                  }
                ]
              },

              // normal products
              {
                $multiply: [
                  {
                    $subtract: [
                      "$saleItems.unitPrice",
                      "$effectiveBuyingPrice"
                    ]
                  },
                  "$saleItems.quantity"
                ]
              }
            ]
          }
        },
        // totalProfit: {
        //   $sum: {
        //     $multiply: [
        //       { 
        //         $subtract: [
        //           { $ifNull: ["$saleItems.unitPrice", 0] },  // Selling price per unit
        //           { $ifNull: ["$effectiveBuyingPrice", 0] }  // Effective buying price per unit
        //         ]
        //       },
        //       { $ifNull: ["$saleItems.quantity", 0] }   // Quantity sold
        //     ]
        //   },
        // },
        totalDiscount: { $sum: { $ifNull: ["$saleItems.lineDiscount", 0] } },
        salesCount: { $sum: 1 },
        totalCashSales: {
          $sum: {
            $cond: [{ $eq: ["$paymentType", "cash"] }, "$totalWithDiscount", 0],
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalSales" },
        totalTaxes: { $sum: "$totalTaxes" },
        totalPurchases: { $sum: "$totalPurchases" },
        totalProfit: { $sum: "$totalProfit" },
        totalDiscount: { $sum: "$totalDiscount" },
        salesCount: { $sum: "$salesCount" },
        totalCashSales: { $sum: "$totalCashSales" },
      },
    },
    {
      $project: {
        _id: 0,
        totalProfitAndSalesValue: {
          totalProfit: "$totalProfit",
          totalSales: "$totalSales",
          totalPurchases: "$totalPurchases",
          totalTaxes: "$totalTaxes",
          totalDiscount: "$totalDiscount",
          salesCount: "$salesCount",
          totalCashSales: "$totalCashSales",
        },
      },
    },
  ]);



  let totalProfit = 0;
  let totalSales = 0;
  let totalPurchases = 0;
  let totalTaxes = 0;
  let totalCashSales = 0;


  if (result.length > 0) {
    totalProfit = parseInt(result[0].totalProfitAndSalesValue.totalProfit);
    totalSales = parseInt(result[0].totalProfitAndSalesValue.totalSales);
    totalPurchases = parseInt(result[0].totalProfitAndSalesValue.totalPurchases);
    totalTaxes = parseInt(result[0].totalProfitAndSalesValue.totalTaxes);
    totalCashSales = parseInt(result[0].totalProfitAndSalesValue.totalCashSales);
  }

  return {
    totalProfit,
    totalCashSales,
    totalSales,
    totalPurchases,
    totalTaxes: parseFloat(parseFloat(totalTaxes).toFixed(2)),
  };
} catch (error) {
  console.error("Error aggregating sales data:", error);
  throw error;
}

};


// Function to calculate financial data for all months in a specific year
const calculateFinancialDataByYear = async (req, res) => {
  try {
    const year = req.params.year;
    const yearlyData = [];

    const promises = [];

    for (let month = 1; month <= 12; month++) {
      const fromDate = new Date(
        `${year}-${month.toString().padStart(2, "0")}-01`
      );
      const toDate = new Date(
        new Date(fromDate).setMonth(fromDate.getMonth() + 1) - 1
      );

      promises.push(
        Promise.all([
          calculateTotalProfitOnSales(fromDate, toDate),
          calculateBadStockValue(fromDate, toDate),
          calculateTotalExpenses(fromDate, toDate),
        ]).then(([totalProfitAndSalesValue, badStockValue, totalExpenses]) => {
          const monthName = fromDate.toLocaleString("default", {
            month: "long",
          }); // Get the full month name
          yearlyData.push({
            month: monthName,
            totalProfitAndSalesValue: totalProfitAndSalesValue,
            badStockValue: badStockValue.badStockValue,
            totalExpenses: totalExpenses.totalExpenses,
          });
        })
      );
    }

    Promise.all(promises).then(() => {
      // Sort the data in chronological order (January to December)
      yearlyData.sort((a, b) => {
        const monthOrder = [
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
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      });

      res.status(200).json(yearlyData);
    });
  } catch (error) {
    console.error("Failed to calculate financial data:", error);
    res.status(500).json({ error: "Failed to calculate financial data" });
  }
};
// Helper function to calculate the total value of bad stock for the month
const calculateBadStockValue = async (startDate, endDate, shopId) => {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: fromDateFormat(startDate), $lte: toDateFormat(endDate) },
        shopId: new ObjectId(shopId),
      },
    },
    {
      $group: {
        _id: null,
        badStockValue: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
      },
    },
  ];

  const result = await BadStock.aggregate(pipeline);

  return result.length > 0 ? result[0] : { badStockValue: 0 };
};

// Helper function to calculate total cashflow for the month
const calculateTotalExpenses = async (startDate, endDate, shopId) => {
  const pipeline = [
    {
      $match: {
        createAt: { $gte: startDate, $lte: endDate },
        shopId: new ObjectId(shopId),
      },
    },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: "$amount" },
      },
    },
  ];

  const result = await Expenses.aggregate(pipeline);
  return result.length > 0 ? result[0] : { totalExpenses: 0 };
};

const sendBackupEmail = async (req, res) => {
  let response = await generateBackup(req.params.id);
  return res.json(response)
}


const updateLastSeen = async (req, res) => {
  const { type, userid } = req.body;
  let update = {
    last_seen: new Date()
  };
  if (type == "attendant") {
    await Attendant.findByIdAndUpdate(userid, update, {
      new: true,
    });
     return res.json({"status":true})
  } else if (type == "admin") {
    await Admin.findByIdAndUpdate(userid, update, {
      new: true,
    });
     return res.json({"status":true})
   }
}

const getStockCountAnalysis = async (req, res) => {
  let { fromDate, toDate, shopId } = req.query;

  try {
    // --------------------------------------
    // FILTER by date range and shop
    // --------------------------------------
    let filter = {};
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(new Date(fromDate).setHours(0,0,0,0));
      }
      if (toDate) {
        filter.createdAt.$lte = new Date(new Date(toDate).setHours(23,59,59,999));
      }
    }
    if (shopId) {
      filter.shopId = shopId;
    }

    // --------------------------------------
    // GET all stock counts in this range
    // --------------------------------------
    const stockCounts = await StockCount.find(filter).lean();

    // --------------------------------------
    // BUILD product id list for buying prices
    // --------------------------------------
    const productIds = new Set();
    for (const sc of stockCounts) {
      for (const item of sc.products) {
        productIds.add(item.productId.toString());
      }
    }

    const products = await Product.find({
      _id: { $in: Array.from(productIds) }
    }).lean();

    const productPriceMap = {};
    for (const p of products) {
      productPriceMap[p._id.toString()] = p.buyingPrice || 0;
    }

    // --------------------------------------
    // FINAL ANALYSIS
    // --------------------------------------
    let totalRecoveredQty = 0;
    let totalLostQty = 0;
    let totalRecoveredCost = 0;
    let totalLostCost = 0;

    for (const sc of stockCounts) {
      for (const item of sc.products) {
        const cost = productPriceMap[item.productId.toString()] || 0;
        const variance = item.variance;

        if (variance > 0) {
          // was undercounted in system, but actually found more (avoided loss)
          totalRecoveredQty += variance;
          totalRecoveredCost += variance * cost;
        } else if (variance < 0) {
          // was supposed to be there, missing (actual loss)
          totalLostQty += Math.abs(variance);
          totalLostCost += Math.abs(variance * cost);
        }
      }
    }

    return res.json({
      totalRecoveredQty,
      totalRecoveredCost,
      totalLostQty,
      totalLostCost
    });

  } catch (e) {
    console.error("Stock count audit analysis error:", e);
    return res.status(500).json({ error: true, message: e.message });
  }
};

module.exports = {
  calculateetProfit,
  calculateStockValue,
  calculateFinancialDataByYear,profitSummary,sendBackupEmail,updateLastSeen,getOutOfStockProductsExcel,getStockCountAnalysis, salesReport
};
