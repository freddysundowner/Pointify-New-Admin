const Cashflow = require("../models/cashflow"); // Import your Cashflow model
const CashFlowCategory = require("../models/cashflowcategory");
const UserPayment = require("../models/payment");
const mongoose = require("mongoose");
const { totalSalesCalculations } = require("../shared/sales");
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");
const { totalPurchasesCalculations } = require("../shared/purchases");
const Expenses = require("../models/expenses");
const Customer = require("../models/customer");
// Create a new cashflow

// Create a new cashflow
const createCashflow = async (req, res) => {
  try {
    const { name, amount, category, attendantId, shopId, bank } = req.body;
    if (amount == 0 || amount < 0) {
      return res.status(500).json({ error: "amount must be more than 0" });
    }
    const cashflow = new Cashflow({
      name,
      amount,
      category,
      attendantId,
      bank,
      shopId,
    });
    await cashflow.save();
    res.status(201).json(cashflow);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to create cashflow" });
  }
};
// Get a list of all cashflow
const getCashflow = async (req, res) => {
  try {
    const filters = {};

    // Filter by category
    if (req.query.category) {
      filters.category = req.query.category; // Assuming category is passed as a query parameter
    }

    // Filter by shop
    if (req.query.shop) {
      filters.shopId = req.query.shop; // Assuming shop is passed as a query parameter
    }

    // Filter by date range (e.g., startDate and endDate)
    if (req.query.start && req.query.end) {
      filters.createAt = {
        $gte: new Date(req.query.start), // Start date
        $lte: new Date(req.query.end).setUTCHours(23, 59, 59, 999), // End date
      };
    }

    const cashflow = await Cashflow.find(filters)
      .populate("category")
      .populate({ path: "attendantId", select: "username" })
      .populate({ path: "shopId", select: "name" });
    res.json(cashflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve cashflow" });
  }
};

// Get a single cashflow by ID
const getCashflowById = async (req, res) => {
  try {
    const cashflow = await Cashflow.findById(req.params.id);
    if (!cashflow) {
      return res.status(404).json({ error: "Cashflow not found" });
    }
    res.json(cashflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve cashflow" });
  }
};

// Get a single cashflow by ID
const getCashflowCategoryTransations = async (req, res) => {
  try {
    const cashflow = await Cashflow.find({
      category: req.params.categoryid,
    })
      .populate("category")
      .populate({ path: "attendantId", select: "username" }).populate("bank")
      .sort({ createAt: -1 });
    if (!cashflow) {
      return res.status(404).json({ error: "Cashflow not found" });
    }
    res.json(cashflow);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve cashflow" });
  }
};

// Get a single cashflow by ID
const getCashflowTransations = async (req, res) => {
  try {
    const cashflow = await Cashflow.find({
      shopId: req.params.shopId,
    }).populate("category");
    if (!cashflow) {
      return res.status(404).json({ error: "Cashflow not found" });
    }
    res.json(cashflow);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve cashflow" });
  }
};

// Update an cashflow by ID
const updateCashflow = async (req, res) => {
  try {
    const { name, amount, category, attendantId, shopId } = req.body;
    const cashflow = await Cashflow.findByIdAndUpdate(
      req.params.id,
      { name, amount, category, attendantId, shopId },
      { new: true }
    );
    if (!cashflow) {
      return res.status(404).json({ error: "Cashflow not found" });
    }
    res.json(cashflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to update cashflow" });
  }
};

// Delete an cashflow by ID
const deleteCashflow = async (req, res) => {
  try {
    const cashflow = await Cashflow.findByIdAndRemove(req.params.id);
    if (!cashflow) {
      return res.status(404).json({ error: "Cashflow not found" });
    }
    res.json({ message: "Cashflow deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete cashflow" });
  }
};
// Calculate total cashflow for a category
const getTotalCashflowByCategory = async (req, res) => {
  let { type, shopId, startDate, endDate } = req.query;
  let filter = {
    shopId: new mongoose.Types.ObjectId(shopId),
  };

  if (type != "all") {
    filter.type = { $eq: type };
  }
  const categoriesWithTotalAmount = await CashFlowCategory.aggregate([
    {
      $match: filter,
    },
    {
      $lookup:
        startDate && endDate
          ? {
              from: "cashflows",
              let: { categoryId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$category", "$$categoryId"] },
                        { $gte: ["$createAt", new Date(startDate)] },
                        {
                          $lte: ["$createAt", new Date(toDateFormat(endDate))],
                        },
                      ],
                    },
                  },
                },
              ],
              as: "cashflows",
            }
          : {
              from: "cashflows",
              localField: "_id",
              foreignField: "category",
              as: "cashflows",
            },
    },
    {
      $unwind: {
        path: "$cashflows",
        preserveNullAndEmptyArrays: type == "all" ? false : true,
      },
    },
    {
      $group: {
        _id: "$_id",
        name: { $first: "$name" },
        createAt: { $first: "$createAt" },
        type: { $first: "$type" },
        totalAmount: { $sum: "$cashflows.amount" },
      },
    },
  ]).sort({ createAt: -1 });

  res.json(categoriesWithTotalAmount);
};

const calculateRevenue = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const totalRevenue = await Sale.aggregate([
      {
        $match: {
          saleDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
            status: "cashed",
          }, // Date range filter
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" }, // Assuming 'totalAmount' is the field representing the sale amount
        },
      },
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    res.json(revenue);
  } catch (error) {
    console.error("Failed to calculate revenue:", error);
    throw error;
  }
};

/*cash flow calculations

  - total sales
  - total expenses
  - total cashout
  - total cashin
  - total purchases
  - customer wallets

  // cash at hand
  cashtahand = (total sales + total cashin + total wallets) - (total expenses + total cash out +  total purchases)

*/

const cashFlowManager = async (req, res) => {
  const { startDate, endDate, shop, paymentType } = req.query;
  try {

    //get current cashflow
    let {
      totalSales,
      cashintotal,
      cashoutotal,
      purchasestotal,
      creditPurchases,
      cashathand,
      walletTotals,totalExpenses,salesDebtTotalPaid,purchasesTotalPaid
    } = await cashFlowManagerCombined(startDate, endDate, shop, paymentType);
    var fromDate = new Date(startDate);
    var todateDate = new Date(endDate);
    fromDate.setMonth(fromDate.getMonth() - 1);
    todateDate.setMonth(todateDate.getMonth() - 1);

  //prev cashflow
    let prevData = await cashFlowManagerCombined(
      fromDate,
      todateDate,
      shop,
      paymentType
    );
    res.json({
      totalSales,
      cashintotal,
      cashoutotal,
      purchasestotal,
      creditPurchases,
      cashathand: cashathand+walletTotals,
      walletTotals,
      balForward: prevData.cashathand, totalExpenses,
      salesDebtTotalPaid,
      purchasesTotalPaid
    });
  } catch (error) {
    console.log(error);
  }
};

const cashFlowManagerCombined = async (
  startDate,
  endDate,
  shop,
  paymentType
) => {
  const filter = {
    createdAt: {
      $gte: fromDateFormat(startDate),
      $lte: toDateFormat(endDate),
    },
    shopId: shop,
  };

  let { totalSales } = await totalSalesCalculations(filter);
  const cashinout = await getCashInOutByDate(startDate, endDate, shop);
  const expenses = await calculateTotalExpenses(startDate, endDate, shop);
  let purchases = await totalPurchasesCalculations(startDate, endDate, shop);
  let salesDebtPaidRepose = await debtPaid(startDate, endDate, shop,"sales");
  let purchasesDebtPaidRepose = await debtPaid(startDate, endDate, shop, "purchases");
  let walletTotals = await calculateTotalWallets({
    ...filter,
    type: paymentType,
  });

  let ci = cashinout.filter((f) => f._id == "cashin");
  let cashintotal = ci.length > 0 ? ci[0]["totalAmount"] : 0;
  let co = cashinout.filter((f) => f._id == "cashout");
  let cashoutotal = co.length > 0 ? co[0]["totalAmount"] : 0;
  let totalExpenses = expenses.totalExpenses;
  let purchasestotal = purchases.length > 0 ? purchases[0]["totalAmount"] : 0;
  let salesDebtTotalPaid = salesDebtPaidRepose.length > 0 ? salesDebtPaidRepose[0]["amountPaid"] : 0;
  let purchasesTotalPaid = purchasesDebtPaidRepose.length > 0 ? purchasesDebtPaidRepose[0]["amountPaid"] : 0;
  let cashathand =
    totalSales + cashintotal + salesDebtTotalPaid - (cashoutotal + purchasestotal + totalExpenses + purchasesTotalPaid);
  return {
    totalSales,
    cashintotal,
    cashoutotal,
    purchasestotal:  purchasestotal,
    cashathand,
    walletTotals,
    totalExpenses,
    salesDebtTotalPaid,
    purchasesTotalPaid
  };
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

getCashInOutByDate = async (startDate, endDate, shop) => {
  return await CashFlowCategory.aggregate([
    {
      $match: {
        shopId: new mongoose.Types.ObjectId(shop),
      },
    },
    {
      $lookup: {
        from: "cashflows",
        let: { categoryId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$category", "$$categoryId"] },
                  {
                    $gte: ["$createAt", toDateFormat(startDate)],
                  },
                  { $lte: ["$createAt", toDateFormat(endDate)] },
                ],
              },
            },
          },
        ],
        as: "cashflows",
      },
    },
    {
      $unwind: {
        path: "$cashflows",
        preserveNullAndEmptyArrays: false, // Set to false to exclude null values
      },
    },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$cashflows.amount" },
      },
    },
  ]);
};

const calculateTotalWallets = async (filter) => {
  const pipeline = [
    {
      $match: {
        shopId: new mongoose.Types.ObjectId(filter.shopId),
      },
    },
    {
      $group: {
        _id: null,
        totalWallet: { $sum: "$wallet" },
      },
    },
    {
      $project: {
        _id: 0,
        totalWallet: 1,
      },
    },
  ];

  const result = await Customer.aggregate(pipeline);
  return result.length > 0 ? result[0]["totalWallet"] : 0;
};

const calculateTotalExpenses = async (startDate, endDate, shopId) => {
  const pipeline = [
    {
      $match: {
        createAt: { $gte: new Date(startDate), $lte: new Date(endDate) },//{ $gte: fromDateFormat(startDate), $lte: toDateFormat(endDate) },
        shopId: new mongoose.Types.ObjectId(shopId),
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

module.exports = {
  createCashflow,
  getCashflow,
  getCashflowById,
  updateCashflow,
  deleteCashflow,
  getCashflowTransations,
  getTotalCashflowByCategory,
  calculateRevenue,
  cashFlowManager,
  calculateTotalWallets,
  getCashflowCategoryTransations,
};
