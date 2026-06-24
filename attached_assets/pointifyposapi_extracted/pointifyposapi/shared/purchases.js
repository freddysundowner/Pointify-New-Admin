const purchase = require("../models/purchase");
const { fromDateFormat,toDateFormat } = require("./validationUtils");
const mongoose = require("mongoose");

exports.totalPurchasesCalculations = async (startDate, endDate, shop) => {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: fromDateFormat(startDate), $lte: toDateFormat(endDate) },
        shopId: new mongoose.Types.ObjectId(shop),
      },
    },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amountPaid" },
      },
    },
  ];

  const result = await purchase.aggregate(pipeline);
  return result;
};
