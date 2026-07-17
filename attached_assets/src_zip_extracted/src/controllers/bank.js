const Cashflow = require("../models/cashflow");
const Bank = require("../models/bank");
const mongoose = require("mongoose");

const createCashflowBank = async (req, res) => {
  try {
    const { name, shop } = req.body;
    let banks = await Bank.find({ shop, name });
    if (banks.length > 0) {
      return res.status(500).json({ error: banks[0].name + " already exists" });
    }
    const bankflow = new Bank({
      name,
      amount: 0,
      shop,
    });
    await bankflow.save();
    res.status(201).json(bankflow);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to create cashflow" });
  }
};

const getBankTransations = async (req, res) => {
  try {
    const cashflow = await Cashflow.find({
      bank: req.params.bankid,
    })
      .populate("bank")
      .populate("category")
      .populate({ path: "attendantId", select: "username" })
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

const updateBank = async (req, res) => {
  try {
    const { name } = req.body;
    const response = await Bank.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );
    if (!response) {
      return res.status(404).json({ error: "Bank not found" });
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Failed to update cashflow" });
  }
};

const deleteBank = async (req, res) => {
  try {
    const cashflow = await Bank.findByIdAndRemove(req.params.id);
    await Cashflow.deleteMany({ bank: req.params.id });
    if (!cashflow) {
      return res.status(404).json({ error: "Cashflow not found" });
    }
    res.json({ message: "Cashflow deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete cashflow" });
  }
};
// Calculate total cashflow for a category
const getBanksList = async (req, res) => {
  let { type, shop } = req.params;
  let filter = {
    shop: new mongoose.Types.ObjectId(shop),
  };
  const response = await Bank.aggregate([
    {
      $match: filter,
    },
    {
      $lookup: {
        from: "cashflows",
        localField: "_id",
        foreignField: "bank",
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
        totalAmount: { $sum: "$cashflows.amount" },
      },
    },
  ]);

  res.json(response);
};
module.exports = {
  deleteBank,
  updateBank,
  getBankTransations,
  getBanksList,
  createCashflowBank,
};
