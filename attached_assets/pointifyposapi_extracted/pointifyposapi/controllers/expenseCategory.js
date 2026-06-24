const ExpenseCategory = require("../models/expensecategory");

const { Types } = require("mongoose");
const Expenses = require("../models/expenses");
const ObjectId = Types.ObjectId;
// Create a new Expenses category
exports.createExpenseCategory = async (req, res) => {
  try {
    const { name, shopId } = req.body;
    const previous = await ExpenseCategory.find({ name, shopId });
    if (previous.length > 0) {
      return res
        .status(400)
        .json({ error: "you already have " + previous[0].name });
    }
    const expenseCategory = new ExpenseCategory({ name, shopId });
    await expenseCategory.save();
    res.status(201).json(expenseCategory);
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
  }
};

// Get all Expenses categories for a specific shop
exports.getExpensesCategories = async (req, res) => {
  try {
    const { shop } = req.query;
    const expenseCategories = await ExpenseCategory.find({
      $or: [{ shopId: new ObjectId(shop) }, { shopId: null }],
    });
    res.json(expenseCategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a specific Expenses category by ID
exports.getExpenseCategoryById = async (req, res) => {
  try {
    const expenseCategory = await ExpenseCategory.findById(req.params.id);
    if (!expenseCategory) {
      return res.status(404).json({ error: "Expenses category not found" });
    }
    res.json(expenseCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update an Expenses category by ID
exports.updateExpenseCategory = async (req, res) => {
  try {
    const expenseCategory = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!expenseCategory) {
      return res.status(404).json({ error: "Expenses category not found" });
    }
    res.json(expenseCategory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete an Expenses category by ID
exports.deleteExpenseCategory = async (req, res) => {
  try {
    const expenseCategory = await ExpenseCategory.findByIdAndDelete(
      req.params.id
    );
    await Expenses.deleteOne({ category: req.params.id });
    if (!expenseCategory) {
      return res.status(404).json({ error: "Expenses category not found" });
    }
    res.json(expenseCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
