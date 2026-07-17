const Expense = require("../models/expenses"); // Import your Expense model
const ExpenseCategory = require("../models/expensecategory");
const mongoose = require("mongoose");
const { toDateFormat } = require("../shared/validationUtils");
const { calculateNextOccurrence } = require("../shared/clonjob");

// Create a new expense
const createExpense = async (req, res) => {
  try {
    const {
      description,
      amount,
      category,
      attendantId,
      shopId,
      frequency,
      autoSave,
    } = req.body;
    if (amount == 0 || amount < 0) {
      return res.status(500).json({ error: "amount must be more than 0" });
    }
    const expense = new Expense({
      description,
      amount,
      category,
      attendant: attendantId,
      shopId,
      frequency,
      nextOccurrence: frequency =='' ? null : calculateNextOccurrence(frequency, new Date()),
      autoSave,
    });
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to create expense" });
  }
};
// Get a list of all expense
const getExpenses = async (req, res) => {
  try {
    const { page, limit, category, shop, startDate, endDate, start, end } = req.query;

    const filters = {
      ...(category && { category }),
      ...(shop && { shopId: shop }),
      ...(startDate && endDate && {
        createAt: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)),
        },
      }),
      ...(start && end && {
        createAt: {
          $gte: new Date(start),
          $lte: new Date(new Date(end).setUTCHours(23, 59, 59, 999)),
        },
      }),
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const isPaginated = Number.isInteger(pageNum) && Number.isInteger(limitNum);

    let query = Expense.find(filters)
      .populate("category")
      .populate({ path: "attendant", select: "username" })
      .populate({ path: "shopId", select: "name" })
      .sort({ createAt: -1 });

    if (isPaginated) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const expenses = await query.exec();
    res.json(expenses);
  } catch (error) {
    console.error("Pagination error:", error);
    res.status(500).json({ error: "Failed to retrieve expenses" });
  }
};
const getExpenseStats = async (req, res) => {
  try {
    const { startDate, endDate, shop, category } = req.query;

    const match = {
      ...(shop && { shopId: new mongoose.Types.ObjectId(shop) }),
      ...(category && { category: new mongoose.Types.ObjectId(category) }),
      ...(startDate && endDate && {
        createAt: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)),
        },
      }),
    };

    const stats = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    const byCategory = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "expensecategories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $project: {
          _id: 0,
          category: "$category.name",
          totalAmount: 1,
          count: 1,
        },
      },
    ]);

    res.json({
      summary: stats[0] || { totalAmount: 0, totalCount: 0 },
      byCategory,
    });
  } catch (error) {
    console.error("Error generating expense stats:", error);
    res.status(500).json({ error: "Failed to get expense stats" });
  }
};



// Get a single expense by ID
const getExpensesById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve expense" });
  }
};

// Get a single expense by ID
const getExpensesCategoryTransations = async (req, res) => {
  try {
    const expense = await Expense.find({
      category: req.params.categoryid,
    })
      .populate("category")
      .populate({ path: "attendant", select: "username" })
      .sort({ createAt: -1 });
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve expense" });
  }
};

// Get a single expense by ID
const getExpensesTransations = async (req, res) => {
  try {
    const expense = await Expense.find({
      shopId: req.params.shopId,
    }).populate("category");
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve expense" });
  }
};

// Update an expense by ID
const updateExpense = async (req, res) => {
  try {
    const {
      description,
      amount,
      category,
      attendantId,
      shopId,
      frequency,
      autoSave,
    } = req.body;
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        description,
        amount,
        category,
        attendantId, 
        frequency,
        shopId,
        nextOccurrence: frequency =='' ? null : calculateNextOccurrence(frequency, new Date()),
        autoSave,
      },
      { new: true }
    );
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to update expense" });
  }
};

// Delete an expense by ID
const deleteExpenseflow = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndRemove(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete expense" });
  }
};
// Calculate total expense for a category
const getTotalExpenseByCategory = async (req, res) => {
  let { type, shopId, startDate, endDate } = req.query;
  let filter = {
    shopId: new mongoose.Types.ObjectId(shopId),
  };

  if (type != "all") {
    filter.type = { $eq: type };
  }
  const categoriesWithTotalAmount = await ExpenseCategory.aggregate([
    {
      $match: filter,
    },
    {
      $lookup:
        startDate && endDate
          ? {
              from: "expenses",
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
              as: "expenses",
            }
          : {
              from: "expenses",
              localField: "_id",
              foreignField: "category",
              as: "expenses",
            },
    },
    {
      $unwind: {
        path: "$expenses",
        preserveNullAndEmptyArrays: type == "all" ? false : true,
      },
    },
    {
      $group: {
        _id: "$_id",
        name: { $first: "$name" },
        createAt: { $first: "$createAt" },
        type: { $first: "$type" },
        totalAmount: { $sum: "$expenses.amount" },
      },
    },
  ]).sort({ createAt: -1 });

  res.json(categoriesWithTotalAmount);
};

module.exports = {
  createExpense,
  getExpenses,
  getExpensesById,
  updateExpense,
  deleteExpenseflow,
  getExpensesTransations,
  getTotalExpenseByCategory,
  getExpensesCategoryTransations,getExpenseStats
};
