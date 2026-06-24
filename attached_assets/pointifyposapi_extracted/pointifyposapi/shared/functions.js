
const axios = require('axios');
const ExcelJS = require("exceljs");
const Product = require("../models/product");
const Customer = require("../models/customer");
const Admin = require("../models/admin");
const Batch = require("../models/batch");
const Shop = require("../models/shop");
const Sale = require("../models/sales");
const SmsLog = require("../models/smslog");
const Subscription = require("../models/subscription");
const mongoose = require("mongoose");
const { END_POINTS } = require("./utils");
const request = require("request");
const BASE_URL = "https://api.safaricom.co.ke/";
const path = require("path");
const { sendEmail } = require('./emailsetup');
const Staff = require("../models/staff");
const Inventory = require("../models/inventory");

const bcrypt = require("bcryptjs");
function calculateNewPriceByShops(shopCount)  {
  const count = Number(shopCount || 0);

  if (count <= 0) return 0;

  // pricing targets
  const startPerShop = 1000;
  const endPerShop = 599;

  // 1 shop => 1000/shop
  // 10 shops => 599/shop

  const maxTier = 10;

  // above 10 shops
  if (count > maxTier) {
    return 5990 + ((count - 10) * 599);
  }

  // linear reduction
  const reductionPerStep =
    (startPerShop - endPerShop) / (maxTier - 1);

  const currentPerShop =
    startPerShop - ((count - 1) * reductionPerStep);

  let total = currentPerShop * count;

  // smart rounding
  if (count <= 3) {
    total = Math.round(total / 100) * 100;
  } else if (count <= 9) {
    total = Math.floor(total / 100) * 100;
  } else {
    total = Math.round(total / 10) * 10;
  }

  return total;
};

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString("en-KE")}`;
}
async function initSystem() {
  let staff = await Staff.find();
  if (staff.length == 0) {
    let password = await bcrypt.hash("admin", 10);
    const staff = new Staff({
      email: "admin@admin.com",
      password: password,
      name: "admin",
    })
    staff.save();
  }

}




const optionsBuilder = async (method, path, body) => {
  var response = await appSettings.find();
  var key = ONESIGNALKEY;
  body["app_id"] = ONESIGNALID;
  // 	console.log(response[0]);
  return {
    method,
    url: `${BASE_URL}/${path}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${key}`,
    },
    body: body ? JSON.stringify(body) : null,
  };
};

const sendNotificationToAll = async (body) => {
  const options = await optionsBuilder("POST", "notifications", body);
  //     console.log(options);
  request(options, (error, response) => {
    if (error) {
      console.log("error sendiing notificatiooon");
    } else {
    }
  });
};
const getPath = (type) => {
  switch (type) {
    case 'deposit':
      return END_POINTS.DEPOSIT
      break;
    case 'ACCESS_TOKEN':
      return END_POINTS.GENERATE_TOKEN
      break;
    case 'withdraw':
      return END_POINTS.WITHDRAW
      break;
    case 'TransactionStatus':
      return END_POINTS.TRANSACTIONSTATUS
      break;
    case 'reverse':
      return END_POINTS.REVERSE
      break;

    default:
      break;
  }
}
let minLimit = 2;
// Function to generate a random integer between min and max (inclusive)
function getRandomInt(min, max) {
  const range = max - min + 1;
  return Math.floor(Math.random() * range) + min;
}
const getPhoneNumberWithoutPlus = (number) => {
  return number.replace(/\D+/g, ''); // Remove all non-digit characters
}
const topUpUserSmsCredit = async (reference, amount) => {
  let id = reference.split('_')[1];
  const admin = await Admin.findById(id);
  admin.smscredit = admin.smscredit + (amount / 0.50);
  admin.save();
}
const validateKenyanPhoneNumber = (number) => {
  console.log(number);
  // Remove any non-digit characters
  const cleanNumber = number.replace(/\D/g, '');

  // Check if the number starts with '0'
  if (cleanNumber.startsWith('0')) {
    // Add the country code and remove the leading '0'
    return '+254' + cleanNumber.slice(1);
  }
  // Check if the number starts with '0'
  if (cleanNumber.startsWith('254')) {
    // Add the country code and remove the leading '0'
    return '+' + cleanNumber;
  }

  // If the number already has the country code, return as is
  if (cleanNumber.startsWith('+254')) {
    return cleanNumber;
  }

  // If the number is not valid, return null
  return null;
};
const normalizeKenyanPhone = (phone) => {
  if (!phone) return null;

  phone = phone.toString().trim().replace(/\s+/g, "");

  // 07XXXXXXXX or 01XXXXXXXX
  if (/^0[71]\d{8}$/.test(phone)) {
    return `+254${phone.slice(1)}`;
  }

  // 2547XXXXXXXX or 2541XXXXXXXX
  if (/^254[71]\d{8}$/.test(phone)) {
    return `+${phone}`;
  }

  // +2547XXXXXXXX or +2541XXXXXXXX
  if (/^\+254[71]\d{8}$/.test(phone)) {
    return phone;
  }

  return null;
};

async function sendSms(phonenumber, text = "") {
  try {
    const url = process.env.SMS_END_POINT;
    const apiKey = process.env.SMS_API_KEY;
    const code = getRandomInt(606851, 362468);

    const normalizedPhone = normalizeKenyanPhone(phonenumber);
    if (!normalizedPhone) {
      return {
        status: 400,
        message: "Invalid Kenyan phone number",
      }
    }
    phonenumber = normalizedPhone;

    const data = {
      phone: phonenumber,
      sender_id: process.env.SMS_SHORT_CODE,
      message: text === "" ? `Your OTP code is ${code}` : text,
      api_key: apiKey,
    };

    const response = await axios.post(url, data);

    // console.log("SMS Response:", response.data, response.data?.status_desc === "Success",response.data?.status_desc);

    if (response.data[0]?.status_desc === "Success") {
      return {
        status: 200,
        code,
      };
    } else {
      return {
        status: 400,
        message: response.data.status_desc || "Unknown error",
        code: null,
      };
    }
  } catch (e) {
    console.error("SMS Error:", e?.response?.data || e.message);
    return {
      status: e.response?.status || 500,
      message: e.response?.data?.status_desc || "SMS sending failed",
      code: null,
    };
  }
}
const sendMpesaStkPush = async ({
  phone,
  amount,
  accountReference,
  transactionDesc = "Deposit",
  callbackUrl,
  transactionType = "CustomerPayBillOnline",
  partyB = process.env.SHORTCODE,
  businessShortCode = process.env.SHORTCODE,
  password = process.env.DEPOSITPASSWORD,
  timestamp = process.env.DEPOSITPASSWORDTIMESTAMP,
}) => {
  try {
    const path = `${BASE_URL}${getPath("deposit")}`;

    const token = await accessToken(
      `${process.env.CONSUMERKEY}:${process.env.SECRETKEY}`
    );

    if (token.status !== 200) {
      return { status: 400, message: "wrong access token" };
    }

    const cleanPhone = getPhoneNumberWithoutPlus(
      validateKenyanPhoneNumber(phone)
    );

    const payload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: amount,
      PartyA: cleanPhone,
      PartyB: partyB,
      PhoneNumber: cleanPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    const response = await axios.post(path, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
      },
    });

    console.log("MPESA STK Response:", response.data);

    return {
      status: 200,
      message: response.data.ResponseCode == 0 ? "waiting" : "failed",
      data: response.data,
    };
  } catch (error) {
    console.log("MPESA STK Error:", error.response?.data || error.message);

    return {
      status: false,
      message: "Error happened, check phone number or contact support",
      error: error.response?.data || error.message,
    };
  }
};
const subscribe = async (body) => {
  const callbackUrl =
    END_POINTS.CONFIRMATION +
    `?subscriptionid=${body.subscriptionid ?? ""}&type=${body.type}`;

  const accountReference =
    body.type === "elimu"
      ? `${body.type}_${body.user_id}`
      : body.randomPart;

  return await sendMpesaStkPush({
    phone: body.phone,
    amount: body.amount,
    accountReference,
    transactionDesc: "Deposit",
    callbackUrl,
  });
};

const topUpWallet = async (body) => {
  return await sendMpesaStkPush({
    phone: body.phone,
    amount: body.amount,
    accountReference: `wallet_${body.userid}`,
    transactionDesc: "Wallet Top Up",
    callbackUrl: `${END_POINTS.CONFIRMATION}?userId=${body.userid}&type=credittopup`,
  });
}; 
const callWithdrawApi = async (body) => {
  let path = `${BASE_URL}${getPath("withdraw")}`
  let token = await accessToken(`${process.env.CONSUMERKEY}:${process.env.SECRETKEY}`);
  if (token.status != 200) return { message: "wrong access token", status: 400 }
  var payload = {
    'InitiatorName': process.env.WITHDRAWUSERNAME,
    'SecurityCredential': process.env.WITHDRAWSECURITYCREDENTIALS,
    'CommandID': 'BusinessPayment',
    'Amount': body.amount,
    'PartyA': process.env.SHORTCODE,
    'PartyB': body.phone,
    'Remarks': 'withdraw',
    'QueueTimeOutURL': END_POINTS.QUEUETIMEOURURL,
    'ResultURL': END_POINTS.RESULTURL + '?userid=' + body.userid + "&transid=" + body.transid,
    'Occasion': 'Ellies Order Completed'
  }
  console.log(payload);
  return await axios.post(path, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.token}`,
    }
  })
};


const checkTransactionStatus = async (body) => {

  let path = `${BASE_URL}${getPath("TransactionStatus")}`
  let token = await accessToken(`${process.env.DEPOSITCONSUMERKEY}:${process.env.DEPOSITSECRETKEY}`);
  if (token.status != 200) return { message: "wrong access token", status: 400 }
  var payload = {
    'Initiator': process.env.WITHDRAWUSERNAME,
    'SecurityCredential': process.env.WITHDRAWSECURITYCREDENTIALS,
    'CommandID': 'TransactionStatusQuery',
    'TransactionID': body.code,
    'PartyA': process.env.SHORTCODE,
    'IdentifierType': '4',
    'Remarks': 'TranactionStatus',
    'QueueTimeOutURL': END_POINTS.QUEUETIMEOURURL,
    'ResultURL': body.call_back + '?payload=' + JSON.stringify(body),
  }
  return await axios.post(path, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.token}`,
    }
  })
    .then(function (response) {
      console.log(response.data);
      return response.data;
    })
    .catch(function (error) {
      console.log(error);
      return { message: error.message, status: error.response.status };
    });
}

const reverse = async (body) => {
  console.log(body);

  let path = `${BASE_URL}${getPath("reverse")}`
  let token = await accessToken(`${process.env.DEPOSITCONSUMERKEY}:${process.env.DEPOSITSECRETKEY}`);
  if (token.status != 200) return { message: "wrong access token", status: 400 }
  var payload = {
    'Initiator': process.env.WITHDRAWUSERNAME,
    'SecurityCredential': process.env.WITHDRAWSECURITYCREDENTIALS,
    'CommandID': 'TransactionReversal',
    "Amount": body.amount,
    'TransactionID': body.code,
    'ReceiverParty': process.env.SHORTCODE,
    'RecieverIdentifierType': '4',
    'Remarks': 'TranactionStatus',
    'QueueTimeOutURL': END_POINTS.QUEUETIMEOURURL,
    'ResultURL': body.call_back + '?payload=' + JSON.stringify(body),
    "Occasion": "work"
  }
  console.log(payload);
  return await axios.post(path, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.token}`,
    }
  })
    .then(function (response) {
      console.log(response.data);
      return response;
    })
    .catch(function (error) {
      console.log(error);
      return { message: error.message, status: error.response.status };
    });
}

const accessToken = async (consumersecretkeys) => {
  console.log(consumersecretkeys);
  let path = `${BASE_URL}${getPath("ACCESS_TOKEN")}`
  let credentials = Buffer.from((consumersecretkeys)).toString('base64');
  console.log(path);
  return await axios.get(path, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    }
  })
    .then(function (response) {
      return { status: 200, token: response.data.access_token };
    })
    .catch(function (error) {
      // console.log(error);
      return { message: error.message, status: error.response.status };
    });
}



const registerUrlC2B = async () => {
  const url = `${BASE_URL}mpesa/c2b/v1/registerurl`;
  console.debug(url);
  let token = await accessToken(`${process.env.CONSUMERKEY}:${process.env.SECRETKEY}`);
  console.log(token);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token.token}`
  };
  console.debug(headers);



  const data = {
    ShortCode: process.env.SHORTCODE,
    ResponseType: 'Cancelled',
    ConfirmationURL: 'https://api.pointifypos.com/payment/confirmation', // Replace with your actual API base URL
    ValidationURL: 'https://api.pointifypos.com/payment/validation' // Replace with your actual API base URL
  };

  try {
    const response = await axios.post(url, data, { headers });

    if (response.data.errorCode) {
      const errorArray = response.data.errorMessage;
      return {
        status: '401',
        message: errorArray
      };
    } else {
      return {
        status: '200',
        message: 'success'
      };
    }
  } catch (error) {
    console.error(error);
    return {
      status: '500',
      message: 'Internal Server Error'
    };
  }
}

async function stockreport(shop, page, limit = 10, name = '') {
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
  console.log("stockReportExcel ", shopId)
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
  console.log({
    filename: name,
    path: attachmentPath,
  })
  return {
    filename: name,
    path: attachmentPath,
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
  const shop = await Shop.findById(shopId).populate("adminId")
  if (shop.adminId == null) return;
  let replacements = {
    "shopname": shop.name,
    "backup_date": new Date().toISOString().slice(0, 10),
    "username": shop.adminId.username,
  }
  console.log(replacements);
  if (shop.backupemail && shop?.adminId?.emailVerified) {
    sendEmail(shop.backupemail, 'Pointify Backup', 'backup', replacements, attachements);
    // try {
    //   sendEmail(shop.backupemail, 'Pointify Backup', 'backup', replacements, attachements);
    // } catch (e) { 
    //   console.log("error generatingBackup ",e)
    // }
    // return {
    //   message: "email with backup attachements sent to " + shop.backupemail
    // }
  }

}

async function generateProductsExcel(shopId) {
  try {
    const products = await Product.find({ shopId }).lean(); // Retrieve products from the MongoDB collection

    // Create a new Excel workbook and add a worksheet
    const fieldsToSkip = ["shopId", "supplierId", "attendantId", "_v", "lastcoundate", "_id"];
    const excelWorkbook = new ExcelJS.Workbook();
    const excelWorksheet = excelWorkbook.addWorksheet("Products");
    if (products.length == 0) return;

    // Define Excel headers
    const excelHeaders = Object.keys(products[0]).filter((header) => !fieldsToSkip.includes(header));
    excelWorksheet.addRow(excelHeaders);

    // Add product data to Excel worksheet
    products.forEach((product) => {
      const excelRow = excelHeaders.map((header) => product[header]);
      excelWorksheet.addRow(excelRow);
    });

    var name = shopId + "_products.xlsx"
    const attachmentPath = path.join(__dirname, name);
    await excelWorkbook.xlsx.writeFile(attachmentPath);

    return {
      filename: name,
      path: attachmentPath,
    };
  } catch (error) {
    console.error("Error generating Excel file:", error);
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
// Function to generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}
// Function to calculate expiration time (in minutes)
function calculateOtpExpirationTime(minutes) {
  const now = new Date();
  return new Date(now.getTime() + minutes * 60000); // 1 minute = 60000 milliseconds
}
function isOtpExpired(expirationTime) {
  const currentTime = new Date();
  return currentTime > expirationTime;
}

async function getAffiliateBonus(affiliateId, amountPaid, commission = 20) {
  try {
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const subscriptions = await Subscription.find({
      type: 'production',
      endDate: { $gt: currentDate },
      startDate: { $gte: startOfMonth, $lte: endOfMonth }
    })
      .populate({
        path: 'userId',
        match: { affliate: affiliateId },
      })
      .select('userId')
      .exec();
    const userIds = [...new Set(
      subscriptions
        .filter(sub => sub.userId !== null)
        .map(sub => sub.userId._id.toString())
    )];


    const userCount = userIds.length;

    let award = 0;
    let bonusEligible = false;
    // Check if the count exceeds the threshold
    if (userCount > 10) {
      commission = 30;
      bonusEligible = true;
    } else if (userCount > 15) {
      commission = 40;
      bonusEligible = true;
    }
    award = (amountPaid * commission) / 100;

    return {
      userIds, // List of user IDs
      userCount, // Count of users
      bonusEligible,
      award // The calculated bonus amount
    };
  } catch (error) {
    return {
      userIds: [],
      userCount: 0,
      bonusEligible: false,
      award: 0
    };
  }
}
async function createNewBatch(product, trackBatch = false) {
  let { _id, buyingPrice, quantity, expiryDate, shopId } = product;
  if (trackBatch == false) {
    return;
  }
  const newBatch = new Batch({
    product: _id,
    buyingPrice: buyingPrice,
    quantity: quantity,
    expirationDate: expiryDate,
    shop: shopId,
    totalQuantity: quantity
  });
  await newBatch.save();
  await Product.findOneAndUpdate(
    { _id: _id },
    { $push: { batches: newBatch._id } },
  );
  console.log('New batch created successfully');
}
const repairMissingInventories = (products = []) => {
  console.log(products);

  setImmediate(async () => {

    try {

      const repairs = [];

      for (const product of products) {

        if (
          !product?._id ||
          !product?.shopId?._id ||
          !product?.attendantId
        ) {
          continue;
        }

        const existingInventory =
          await Inventory.exists({
            product: product._id,
            shop: product.shopId._id
          });

        // already has inventory
        if (existingInventory) {
          continue;
        }

        repairs.push({
          quantity: product.quantity || 0,
          lastCount: product.quantity || 0,
          reorderLevel: product.reorderLevel || 0,
          product: product._id,
          shop: product.shopId._id,
          attendant: product.attendantId,
          expiryDate: product.expiryDate || null,
          barcode: product.barcode || null
        });
      }

      if (repairs.length > 0) {

        await Inventory.insertMany(
          repairs,
          { ordered: false }
        );

        console.log(
          `AUTO INVENTORY REPAIR | Created ${repairs.length}`
        );
      }

    } catch (err) {

      console.error(
        "AUTO INVENTORY REPAIR ERROR",
        err.message
      );
    }
  });
};
function buildSaleSmsMessage({
  template,
  customerName,
  shopName,
  amount,
  receiptNumber,
  receiptUrl,
}) {
  return String(template || "")
    .replaceAll("{name}", customerName || "Customer")
    .replaceAll("{shop}", shopName || "Our Shop")
    .replaceAll("{amount}", amount != null ? String(amount) : "0")
    .replaceAll("{receipt}", receiptNumber || "")
    .replaceAll("{receipt_url}", receiptUrl || "");
}

function normalizePhone(phone) {
  if (!phone) return null;

  let value = String(phone).trim().replace(/\s+/g, "");

  if (value.startsWith("+")) return value;
  if (value.startsWith("0")) return `+254${value.substring(1)}`;
  if (value.startsWith("254")) return `+${value}`;

  return value;
}

function buildReceiptUrl({ receiptId }) {
  return `https://store.pointifypos.com/${receiptId}`;
}
function getSmsParts(message = "") {
  const text = String(message);

  const isUnicode = /[^\x00-\x7F]/.test(text);

  if (isUnicode) {
    return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
  }

  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}
async function sendSaleSmsAfterSale({
  sale,
  template
}) {
  // console.log("sendSaleSmsAfterSale", sale);
  try {
    if (!sale?.shopId) {
      return {
        success: false,
        message: "Shop not found",
      };
    }
    let adminresponse = await Admin.findOne({
      _id: sale?.shopId?.adminId
    });
    // console.log("adminresponse", adminresponse);
    if (!adminresponse.saleSmsEnabled) {
      return {
        success: false,
        message: "Sale SMS disabled",
      };
    }
    if (adminresponse.smscredit <= 0) {
      return {
        success: false,
        message: "SMS credit not enough",
      };
    }

    const phone = normalizePhone(sale?.customerId?.phonenumber || sale?.customerPhone);
    if (!phone) {
      return {
        success: false,
        message: "Customer phone missing",
      };
    }

    const templatee =
      template || adminresponse.saleSmsTemplate ||
      "Hi {name}, thank you for your purchase at {shop}. Amount: {amount}. Receipt #{receipt}. View: {receipt_url}";

    const receiptNumber =
      sale?.receiptNo;

    const receiptUrl = buildReceiptUrl({
      receiptId: sale?._id?.toString() || receiptNumber,
    });

    const message = buildSaleSmsMessage({
      template: templatee,
      customerName: sale?.customerId?.name || sale?.customerName || "Customer",
      shopName: sale?.shopId?.name || "Our Shop",
      amount: sale?.amountPaid ?? 0,
      receiptNumber,
      receiptUrl,
    });
    console.log("message", message);

    const response = await sendSms(phone, message);
    console.log("response", response);
    if (response.status != 200) {
      return {
        success: false,
        message: "Failed to send SMS",
      };
    }
    const smsParts = getSmsParts(message);
    const creditUsed = smsParts;

    if (adminresponse.smscredit < creditUsed) {
      return {
        success: false,
        message: `SMS credit not enough. Needed ${creditUsed}, available ${adminresponse.smscredit}`,
      };
    }

    if (response.status != 200) {
      await SmsLog.create({
        adminId: sale?.shopId?.adminId,
        shopId: sale?.shopId?._id,
        saleId: sale?._id,
        customerId: sale?.customerId?._id,
        phone,
        message,
        characterCount: message.length,
        smsParts,
        creditUsed: 0,
        smsType: "sale",
        status: "failed",
        providerResponse: response,
        errorMessage: response.message || "Failed to send SMS",
      });

      return {
        success: false,
        message: "Failed to send SMS",
      };
    }

    await Admin.findOneAndUpdate(
      { _id: sale?.shopId?.adminId },
      { $inc: { smscredit: -creditUsed } }
    );

    await SmsLog.create({
      adminId: sale?.shopId?.adminId,
      shopId: sale?.shopId?._id,
      saleId: sale?._id,
      customerId: sale?.customerId?._id,
      phone,
      message,
      characterCount: message.length,
      smsParts,
      creditUsed,
      smsType: "sale",
      status: "success",
      providerResponse: response,
    });


    return {
      success: true,
      message: "SMS sent successfully",
      data: response,
    };
  } catch (error) {
    console.error("sendSaleSmsAfterSale error:", error);
    return {
      success: false,
      message: error.message || "Failed to send SMS",
    };
  }
}
module.exports = {
  subscribe,
  checkTransactionStatus,
  reverse,
  stockreport,
  callWithdrawApi,
  registerUrlC2B,
  generateBackup,
  generateOTP,
  calculateOtpExpirationTime,
  isOtpExpired,
  sendSms,
  sendNotificationToAll,
  getAffiliateBonus,
  createNewBatch, stockReportExcel, initSystem, sendSaleSmsAfterSale, topUpWallet, topUpUserSmsCredit, calculateNewPriceByShops, repairMissingInventories
}