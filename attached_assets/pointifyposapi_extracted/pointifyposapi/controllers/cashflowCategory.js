const CashFlowCategory = require("../models/cashflowcategory");

const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;
// Create a new cashflow category
exports.createCashflowCategory = async (req, res) => {
  try {
    const { name, shopId, type } = req.body;
    const previous = await CashFlowCategory.find({ name, shopId });
    if (previous.length > 0) {
      return res
        .status(400)
        .json({ error: "you already have " + previous[0].name });
    }
    const expenseCategory = new CashFlowCategory({ name, shopId, type });
    await expenseCategory.save();
    res.status(201).json(expenseCategory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all cashflow categories for a specific shop
exports.getCashflowCategories = async (req, res) => {
  try {
      const { id, type } = req.params;
  
      const match = {
        shopId: new ObjectId(id),
      };
  
      if (type !== "all") {
        match.type = type;
      }
  
      const categoriesWithTotals = await CashFlowCategory.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "cashflows",
            localField: "_id",
            foreignField: "category",
            as: "cashflows",
          },
        },
        {
          $addFields: {
            amount: { $sum: "$cashflows.amount" },
          },
        },
        {
          $project: {
            name: 1,
            type: 1,
            shopId: 1,
            amount: 1,
          },
        },
        {
          $sort: { name: 1 },
        },
      ]);
  
      res.json(categoriesWithTotals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a specific cashflow category by ID
exports.getExpenseCategoryById = async (req, res) => {
  try {
    const expenseCategory = await CashFlowCategory.findById(req.params.id);
    if (!expenseCategory) {
      return res.status(404).json({ error: "Cashflow category not found" });
    }
    res.json(expenseCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update an cashflow category by ID
exports.updateExpenseCategory = async (req, res) => {
  try {
    const expenseCategory = await CashFlowCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!expenseCategory) {
      return res.status(404).json({ error: "Cashflow category not found" });
    }
    res.json(expenseCategory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete an cashflow category by ID
exports.deleteExpenseCategory = async (req, res) => {
  try {
    const expenseCategory = await CashFlowCategory.findByIdAndDelete(
      req.params.id
    );
    if (!expenseCategory) {
      return res.status(404).json({ error: "Cashflow category not found" });
    }
    res.json(expenseCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
