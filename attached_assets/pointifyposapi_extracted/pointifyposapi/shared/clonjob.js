const Expenses = require("../models/expenses");
const cron = require("node-cron");
const Subscription = require("../models/subscription");
const { sendEmailNew } = require("./emailsetup");
const { sendSms } = require("./functions");
const shop = require("../models/shop");
const admin = require("../models/admin");
const { Types } = require("mongoose");
const mongoose = require("mongoose");
const Package = require("../models/package");
const ExcelJS = require("exceljs");
const Product = require("../models/product");
const Customer = require("../models/customer");
const path = require("path");
const Sale = require("../models/sales");
const SaleItem = require('../models/saleitem');
const fs = require('fs');
async function generateProductsExcel(shopId) {
  try {
    const products = await Product.find({
      shopId,
    }).lean();

    if (products.length === 0) return;

    const excelWorkbook =
      new ExcelJS.Workbook();

    const excelWorksheet =
      excelWorkbook.addWorksheet(
        "Products"
      );

    // CLEAN BUSINESS HEADERS
    excelWorksheet.columns = [
      {
        header: "Product Name",
        key: "name",
        width: 35,
      },
      {
        header: "Buying Price",
        key: "buyingPrice",
        width: 18,
      },
      {
        header: "Selling Price",
        key: "sellingPrice",
        width: 18,
      },
      {
        header: "Dealer Price",
        key: "dealerPrice",
        width: 18,
      },
      {
        header: "Wholesale Price",
        key: "wholesalePrice",
        width: 20,
      },
      {
        header: "Stock Quantity",
        key: "quantity",
        width: 18,
      },
      {
        header: "Minimum Stock",
        key: "reorderLevel",
        width: 18,
      },
      {
        header: "Barcode",
        key: "barcode",
        width: 25,
      },
      {
        header: "Serial Number",
        key: "serialNumber",
        width: 25,
      },
      {
        header: "Category",
        key: "category",
        width: 25,
      },
      {
        header: "Brand",
        key: "brand",
        width: 25,
      },
      {
        header: "Description",
        key: "description",
        width: 40,
      },
      {
        header: "Expiry Date",
        key: "expiryDate",
        width: 20,
      },
      {
        header: "Created Date",
        key: "date",
        width: 20,
      },
    ];

    // STYLE HEADER
    excelWorksheet.getRow(1).font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    excelWorksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "10B981",
      },
    };

    // DATA
    products.forEach((product) => {
      excelWorksheet.addRow({
        name: product.name || "",

        buyingPrice:
          product.buyingPrice || 0,

        sellingPrice:
          product.sellingPrice || 0,

        dealerPrice:
          product.dealerPrice || 0,

        wholesalePrice:
          product.wholesalePrice || 0,

        quantity:
          product.quantity || 0,

        reorderLevel:
          product.reorderLevel || 0,

        barcode:
          product.barcode || "",

        serialNumber:
          product.serialnumber || "",

        category:
          product.productCategory ||
          "",

        brand:
          product.manufacturer || "",

        description:
          product.description || "",

        expiryDate:
          product.expiryDate
            ? new Date(
              product.expiryDate
            ).toLocaleDateString()
            : "",

        date: product.date
          ? new Date(
            product.date
          ).toLocaleDateString()
          : "",
      });
    });

    // AUTO FILTER
    excelWorksheet.autoFilter = {
      from: "A1",
      to: "N1",
    };

    const name =
      shopId + "_products.xlsx";

    const attachmentPath = path.join(
      __dirname,
      name
    );

    await excelWorkbook.xlsx.writeFile(
      attachmentPath
    );

    return {
      filename: name,
      path: attachmentPath,
    };
  } catch (error) {
    console.error(
      "Error generating Excel file:",
      error
    );
  }
}


async function generateCustomerExcel(shopId) {
  try {
    const customers = await Customer.find({ shopId }).lean(); // Retrieve all customers from the MongoDB collection

    // Create a new Excel workbook and add a worksheet
    const excelWorkbook = new ExcelJS.Workbook();
    const excelWorksheet = excelWorkbook.addWorksheet("Customers");

    // Define Excel headers
    const excelHeaders = [
      "name",
      "phonenumber",
      "email",
      "address",
      "type",
      "wallet",
      "attendantId",
      "customerNo",
      "createAt",
      "outstandingBalance", // Include outstandingBalance
    ];
    excelWorksheet.addRow(excelHeaders);

    // Add customer data to Excel worksheet
    for (const customer of customers) {
      // Calculate outstandingBalance based on sales
      const sales = await Sale.find({ customerId: customer._id }).populate("attendantId", "username").lean();
      const outstandingBalance = sales.reduce((total, sale) => total + sale.outstandingBalance, 0);

      const excelRow = [
        customer.name,
        customer.phonenumber,
        customer.email,
        customer.address,
        customer.type,
        customer.wallet,
        customer?.attendantId ? sales[0]?.attendantId?.username : "",
        customer.customerNo,
        customer.createAt,
        outstandingBalance, // Include outstandingBalance
      ];

      excelWorksheet.addRow(excelRow);
    }

    var name = shopId + "_customers.xlsx"
    const attachmentPath = path.join(__dirname, name);
    await excelWorkbook.xlsx.writeFile(attachmentPath);

    return {
      filename: name,
      path: attachmentPath,
    };
  } catch (error) {
    console.error("Error generating Customers Excel file:", error);
  }
}
async function stockreport(shop, page, limit = 10, name = '') {
  console.log(shop, page, limit);
  limit = parseInt(limit);
  let productName = name;
  try {
    const pipeline = [
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shop),
          ...(productName && { name: { $regex: productName, $options: 'i' } }), // Case-insensitive search by product name
        },
      },
      {
        $lookup: {
          from: 'saleitems',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$product', '$$productId'] },
                    { $eq: ['$status', 'cashed'] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productInfo',
              },
            },
            {
              $unwind: '$productInfo',
            },
            {
              $group: {
                _id: null,
                totalSales: { $sum: { $multiply: ['$unitPrice', '$quantity'] } },
                totalProfit: {
                  $sum: {
                    $subtract: [
                      { $multiply: ['$unitPrice', '$quantity'] }, // Total revenue
                      { $multiply: ['$productInfo.buyingPrice', '$quantity'] }, // Total cost
                    ],
                  },
                },
                totalSoldQuantity: { $sum: '$quantity' },
              },
            },
          ],
          as: 'sales',
        },
      },
      {
        $addFields: {
          totalSales: {
            $ifNull: [{ $arrayElemAt: ['$sales.totalSales', 0] }, 0],
          },
          totalProfit: {
            $ifNull: [{ $arrayElemAt: ['$sales.totalProfit', 0] }, 0],
          },
          totalSoldQuantity: {
            $ifNull: [{ $arrayElemAt: ['$sales.totalSoldQuantity', 0] }, 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          inStockQuantity: '$quantity', // Assuming this is the quantity field for products
          totalSales: 1,
          totalProfit: 1,
          totalSoldQuantity: 1,
        },
      },
    ];

    // Conditionally add pagination stages if `page` is provided and greater than 0
    if (page && page > 0) {
      pipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: limit }
      );
    }

    const stockReport = await Product.aggregate(pipeline);

    // Optionally, return the total count for pagination metadata only if pagination is enabled
    if (page && page > 0) {
      const totalCount = await Product.countDocuments({
        shopId: new mongoose.Types.ObjectId(shop),
        ...(productName && { name: { $regex: productName, $options: 'i' } }), // Include the product name filter for the total count
      });
      return {
        data: stockReport,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    }

    return stockReport;
  } catch (error) {
    throw error;
  }

}

async function stockReportExcel(shopId) {
  const stockReport = await stockreport(shopId);
  const headers = [
    "name",
    "inStockQuantity",
    "totalSales",
    "totalProfit",
    "totalSoldQuantity",
  ];

  // Create a new Excel workbook and add a worksheet 
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Stock Report");

  // Add headers to the worksheet
  worksheet.addRow(headers);

  // Add data to the worksheet
  stockReport.forEach((product) => {
    const rowData = [
      product.name,
      product.inStockQuantity,
      product.totalSales,
      product.totalProfit,
      product.totalSoldQuantity,
    ];

    worksheet.addRow(rowData);
  });
  var name = shopId + "_Stockreport.xlsx"
  const attachmentPath = path.join(__dirname, name);
  await workbook.xlsx.writeFile(attachmentPath);

  return {
    filename: name,
    path: attachmentPath,
  };
}
async function generateSalesExcel(shopId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sales = await Sale.find({
    shopId: shopId,
    createdAt: { $gte: today, $lt: tomorrow },
  })
    .populate("customerId", "name")
    .populate("attendantId", "name")
    .populate({
      path: "items",
      populate: {
        path: "product",
        select: "name"
      }
    });

  if (!sales.length) return null;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');

  // Header
  sheet.columns = [
    { header: 'Receipt No', key: 'receiptNo', width: 15 },
    { header: 'Date', key: 'createdAt', width: 20 },
    { header: 'Customer', key: 'customerName', width: 20 },
    { header: 'Attendant', key: 'attendantName', width: 20 },
    { header: 'Sale Type', key: 'saleType', width: 15 },
    { header: 'Payment Type', key: 'paymentType', width: 15 },
    { header: 'Total Amount', key: 'totalAmount', width: 15 },
    { header: 'Discount', key: 'saleDiscount', width: 12 },
    { header: 'Tax', key: 'totaltax', width: 10 },
    { header: 'Item Count', key: 'itemCount', width: 10 },
    { header: 'Items Summary', key: 'itemsSummary', width: 50 },
  ];

  // Rows
  for (let sale of sales) {
    const itemsSummary = sale.items.map(item => {
      const productName = item?.product?.name || "N/A";
      return `${productName} x${item.quantity} @${item.unitPrice} (-${item.lineDiscount})`;
    }).join('; ');

    sheet.addRow({
      receiptNo: sale.receiptNo,
      createdAt: sale.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      customerName: sale.customerId?.name || 'Walk-in',
      attendantName: sale.attendantId?.name || 'N/A',
      saleType: sale.saleType,
      paymentType: sale.paymentType,
      totalAmount: sale.totalAmount,
      saleDiscount: sale.saleDiscount,
      totaltax: sale.totaltax || 0,
      itemCount: sale.items.length,
      itemsSummary
    });
  }

  // Save the file
  const fileName = `sales-${shopId}-${today.toISOString().slice(0, 10)}.xlsx`;
  const dir = path.join(__dirname, 'backups');
  const filePath = path.join(dir, fileName);

  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  await workbook.xlsx.writeFile(filePath);

  return {
    filename: fileName,
    path: filePath,
  };
}
async function generateBackup(shopId) {
  let attachements = [];
  let stockattachment = await stockReportExcel(shopId);
  let productsattachment = await generateProductsExcel(shopId)
  let customersattachment = await generateCustomerExcel(shopId)
  if (stockattachment != null && stockattachment.path != '') {
    attachements.push(stockattachment)
  }
  if (productsattachment != null && productsattachment.path != '') {
    attachements.push(productsattachment)
  }
  if (customersattachment != null && customersattachment.path != '') {
    attachements.push(customersattachment)
  }
  let salesattachment = await generateSalesExcel(shopId);
  if (salesattachment?.path) attachements.push(salesattachment);
  const shopres = await shop.findById(shopId).populate("adminId")
  if (shopres.adminId == null) return;
  let replacements = {
    "shopname": shopres.name,
    "backup_date": new Date().toISOString().slice(0, 10),
    "username": shopres.adminId.username,
  }
  console.log(replacements);
  if (shopres.adminId?.email) {
    await sendEmailNew({
      recipientEmail: shopres.backupemail,
      recipientName: shopres.adminId.username,
      slug: 'backup', subject: `Daily Backup Report - ${shopres.name}`,
      placeholders: {
        shopname: shopres.name,
        backup_date: new Date().toISOString().slice(0, 10),
        username: shopres.adminId.username
      },
      attachments: attachements
    });
    for (const file of attachements) {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }

}
const autoSaveExpenses = async () => {
  const now = new Date();
  const today = new Date(now.toISOString().split("T")[0]);

  const template = await Expenses.findOneAndUpdate(
    {
      autoSave: true,
      nextOccurrence: { $lte: now },
      $or: [
        { lastRunDate: null },
        { lastRunDate: { $lt: today } },
      ],
    },
    {
      $set: {
        lastRunDate: today,
        nextOccurrence: calculateNextOccurrence("daily", now),
      },
    },
    { new: true }
  );

  if (!template) return;

  await Expenses.create({
    description: template.description,
    amount: template.amount,
    shopId: template.shopId,
    attendant: template.attendant,
    category: template.category,
    autoSave: false,
  });
};

cron.schedule("0 8 * * *", autoSaveExpenses);
// cron.schedule("*/5 * * * * *", autoSaveExpenses);

function calculateNextOccurrence(frequency, lastOccurrence) {
  // Convert lastOccurrence to a JavaScript Date object
  const lastOccurrenceDate = new Date(lastOccurrence);

  // Initialize the next occurrence date
  let nextOccurrenceDate;

  switch (frequency) {
    case "daily":
      //   nextOccurrenceDate = new Date(lastOccurrenceDate);
      //   nextOccurrenceDate.setMinutes(lastOccurrenceDate.getMinutes() + 1);
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      nextOccurrenceDate.setDate(lastOccurrenceDate.getDate() + 1);
      break;

    case "start_of_month":
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      nextOccurrenceDate.setMonth(lastOccurrenceDate.getMonth() + 1);
      nextOccurrenceDate.setDate(1);
      break;

    case "end_of_month":
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      nextOccurrenceDate.setMonth(lastOccurrenceDate.getMonth() + 2);
      nextOccurrenceDate.setDate(0);
      break;
    case "end_of_year":
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      nextOccurrenceDate.setFullYear(lastOccurrenceDate.getFullYear() + 1);
      nextOccurrenceDate.setMonth(0);
      nextOccurrenceDate.setDate(0);
      break;

    case "weekday":
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      do {
        nextOccurrenceDate.setDate(nextOccurrenceDate.getDate() + 1);
      } while (
        nextOccurrenceDate.getDay() === 0 ||
        nextOccurrenceDate.getDay() === 6
      );
      break;

    case "weekend":
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      do {
        nextOccurrenceDate.setDate(nextOccurrenceDate.getDate() + 1);
      } while (
        nextOccurrenceDate.getDay() !== 0 &&
        nextOccurrenceDate.getDay() !== 6
      );
      break;

    case "end_of_year":
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      nextOccurrenceDate.setFullYear(lastOccurrenceDate.getFullYear() + 1);
      nextOccurrenceDate.setMonth(0);
      nextOccurrenceDate.setDate(0);
      break;

    case "current_date_of_month":
      console.log("lastOccurrenceDate", lastOccurrenceDate);
      nextOccurrenceDate = new Date(lastOccurrenceDate);
      nextOccurrenceDate.setMonth(nextOccurrenceDate.getMonth() + 1);
      nextOccurrenceDate.setDate(new Date(lastOccurrenceDate).getDate());

      // nextOccurrenceDate.setDate(new Date().getDate());
      console.log("nn lastOccurrenceDate", nextOccurrenceDate);
      break;

    default:
      console.log("error");
  }

  return nextOccurrenceDate;
}
function isToday(date) {
  const today = new Date();

  // Compare year, month, and day
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}
//send reminder at 3pm that subscription is expiring in less tha 5 days
cron.schedule('0 15 * * *', checkSubscription);
async function checkSubscription() {
  const currentDate = new Date();
  const endDateThreshold = new Date(currentDate);
  endDateThreshold.setDate(currentDate.getDate() + 5);
  try {
    const allsubscriptions = await Subscription.aggregate([
      {
        $match: {
          endDate: {
            $gte: currentDate, // Filter subscriptions where endDate is >= currentDate
            $lte: endDateThreshold, // and endDate is <= endDateThreshold
          },
          type: 'production',
        },
      },
      {
        $sort: { endDate: 1 } // Sort by end date in ascending order to get the earliest subscription first
      },
      {
        $group: {
          _id: "$userId", // Group by userId
          subscription: { $first: "$$ROOT" } // Get the first subscription for each userId
        },
      },
      {
        $replaceRoot: { newRoot: "$subscription" } // Restructure to keep the original schema format
      }
    ]);

    // Populate userId and shop fields
    const subscriptions = await Subscription.populate(allsubscriptions, [
      { path: 'userId', model: 'Admin' }, // Populate userId referencing Admin model
      { path: 'shops', model: 'Shop' } // Populate shop referencing Shop model
    ]);
    subscriptions.forEach(async (subscription) => {
      let { endDate } = subscription
      let { username, phone, email, emailVerified } = subscription.userId;
      let shops = subscription.shops;
      const shopNames = shops.map(shop => shop.name);

      console.log(subscription._id);
      const replacements = {
        username: username,
        shopname: shopNames.join(","),
        expiry_date: new Date(endDate).toDateString()
      };
      console.log(replacements);
      if (emailVerified == true) {
        await sendEmailNew({
          recipientEmail: email,
          recipientName: username,
          subject: 'Subscription Expiry',
          slug: 'subscriptionexpiry',
          placeholders: {
            username: username,
            shopname: shopNames.join(","),
            expiry_date: new Date(endDate).toDateString()
          }
        });
      }
      sendSms(phone, `Hi ${username},\nYour ${shopNames} subscriptions will expire on ${new Date(endDate).toDateString()}.`)

    });
  } catch (error) {
    console.log('Error fetching subscriptions:', error.message);
  }

}
// cron.schedule('* * * * *', setupCronJobForShop);
cron.schedule('0 0 * * *', setupCronJobForShop);
// generate backup and send to shop owners
async function setupCronJobForShop() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shopsWithBackupdateToday = await shop.find().populate("adminId");
    console.log("shops ", shopsWithBackupdateToday)

    for (const singleShop of shopsWithBackupdateToday) {
      if (singleShop?.adminId) {
        // Check if this shop has a valid subscription
        const validSubscription = await Subscription.findOne({
          _id: singleShop.subscription,
          status: true,
          paid: true,
          endDate: { $gte: today }
        });

        if (validSubscription) {
          await generateBackup(singleShop._id);

          const nextBackupDate = new Date();
          nextBackupDate.setDate(today.getDate() + 1);
          singleShop.backupdate = nextBackupDate;
          await singleShop.save();
        }
      }
    }
  } catch (error) {
    console.error("Error in setupCronJobForShop:", error);
  }
}
//send reminder every day at 3pm for 30 days to remind user who had subscribed but it has expired
//else the shop will be deleted
cron.schedule("0 15 * * *", async () => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() - 30);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const adminsresponse = await admin.aggregate([
    {
      $match: {
        $or: [
          { lastSubscriptionReminderCount: { $gt: 0 } },
          { lastSubscriptionReminderCount: null }
        ],
        $or: [
          { lastSubscriptionReminder: { $lte: twoDaysAgo } },
          { lastSubscriptionReminder: null }
        ],
        // email: "mwangi2githumbi@gmail.com",
        emailVerified: true,
        primaryShop: { $ne: null }
      }
    },
    {
      $lookup: {
        from: 'shops',
        localField: 'primaryShop',
        foreignField: '_id',
        as: 'primaryShopDetails'
      }
    },
    { $unwind: "$primaryShopDetails" },
    {
      $lookup: {
        from: 'subscriptions', // Name of the subscription collection
        localField: 'primaryShopDetails.subscription',
        foreignField: '_id',
        as: 'primaryShopDetails.subscriptionDetails'
      }
    },
    { $unwind: "$primaryShopDetails.subscriptionDetails" },
    {
      $match: {
        'primaryShopDetails.subscriptionDetails.endDate': { $lt: thirtyDaysFromNow }
      }
    }
  ]);
  const batchSize = 50; // Adjust as needed
  const interval = 5000; // 5 seconds interval, adjust as needed

  let currentIndex = 0;

  function sendBatchOfEmails() {
    const batchUsers = adminsresponse.slice(currentIndex, currentIndex + batchSize);
    currentIndex += batchSize;
    batchUsers.forEach(async adminData => {
      const { primaryShopDetails, username, email } = adminData;
      const { subscriptionDetails, name } = primaryShopDetails || {};

      let remainingDays = adminData?.lastSubscriptionReminderCount == null ? 30 : adminData?.lastSubscriptionReminderCount - 1;

      await admin.findByIdAndUpdate(adminData?._id, { lastSubscriptionReminderCount: remainingDays, lastSubscriptionReminder: new Date() })
      const endDate = new Date(subscriptionDetails.endDate);
      const currentDate = new Date();
      const differenceMs = currentDate - endDate;
      const differenceDays = Math.floor(differenceMs / (1000 * 60 * 60 * 24));
      if (remainingDays > 0 && email) {
        await sendEmailNew({
          recipientEmail: email,
          recipientName: username,
          slug: 'subscriptionreminder',
          placeholders: {
            username,
            shopname: name.toUpperCase(),
            days: remainingDays ?? 7,
            differenceDays: differenceDays
          }
        });
      }
    });

    // Check if there are more users to process
    if (currentIndex < adminsresponse.length) {
      // Schedule the next batch after the interval
      setTimeout(sendBatchOfEmails, interval);
    }
  }
  sendBatchOfEmails();
})


module.exports = {
  autoSaveExpenses,
  calculateNextOccurrence,
  checkSubscription,
  setupCronJobForShop,
  generateBackup
};
