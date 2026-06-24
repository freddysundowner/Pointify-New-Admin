const Sale = require("../models/sales");

exports.totalSalesCalculations = async (filter) => {
  filter.status = "cashed";
  const sales = await Sale.find(filter).populate({
    path: "items",
    populate: {
      path: "product",
    },
  });

  // Initialize total sales and profit
  let totalSales = 0;
  let totalProfit = 0;

  for (const sale of sales) {
    // Calculate the total sales amount for this sale
    if (sale.paymentType == "credit") {
      totalSales +=  sale.amountPaid ?? 0;
    } else {
      totalSales +=  sale.totalWithDiscount ?? 0;
    }
    // totalSales +=  sale.outstandingBalance ?? 0;
    // Iterate through the sale items and calculate profit for each sale item
    for (const saleItem of sale.items) {
      // Calculate profit for each sale item using the product's price
      const productPrice = saleItem.product ? saleItem.product.buyingPrice : 0;
      const itemProfit =
        saleItem.unitPrice * saleItem.quantity -
        saleItem.lineDiscount * saleItem.quantity -
        productPrice * saleItem.quantity;
      // Add the item profit to the total profit
      totalProfit += itemProfit;
    }
  }

  return { totalProfit, totalSales };
};
