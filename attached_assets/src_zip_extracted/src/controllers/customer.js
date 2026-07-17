const Customer = require("../models/customer");
const UserPayment = require("../models/payment");
const excelJS = require('exceljs');
const Sale = require("../models/sales");
const mongoose = require("mongoose");
const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;
const sales = require("../models/sales");
const bcrypt = require("bcryptjs");
const { sendEmail } = require("../shared/emailsetup");
const { generateOTP, calculateOtpExpirationTime, isOtpExpired } = require("../shared/functions");

const customerVerify = async (req, res) => {
  const { email, phonenumber } = req.body;
  try {
    const customer = Customer.find({
      $or: [
        { email: email },
        { phonenumber: phonenumber }
      ]
    });
    if (customer.length > 0) {
      res.status(201).json({ exists: true, error: "customer with that phone number or email exists." });
    } else {
      res.status(201).json({ exists: false });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};
// Create a new customer
const createCustomer = async (req, res) => {
  const { name, wallet, shopId, attendantId, online = false, password, email, phonenumber, owner } = req.body;
  try {
    if (online == true) {
      const customer = new Customer({
        name,
        password: await bcrypt.hash(password, await bcrypt.genSalt(10)),
        phonenumber,
        email,
        type: "online"
      });
      await customer.save();
      res.status(201).json(customer);
    } else {
      const customer = new Customer({ name, wallet, shopId, attendantId, phonenumber, email, owner });
      const savedCustomer = await customer.save();
      res.status(201).json(savedCustomer);
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};
const calculateTotalPayments = (sale) => {
  let totalPayments = 0;

  if (sale.payments && sale.payments.length > 0) {
    sale.payments.forEach((payment) => {
      totalPayments += payment.amount;
    });
  }

  return totalPayments;
}
// Update a customer by ID
const updateCustomer = async (req, res) => {
  const { name, wallet, shopId, attendantId, phonenumber, email, address, creditLimit, payment_method = "cash" } =
    req.body;
  console.log(req.body)
  try {
    if (wallet > 0) {
      const lastPayment = await UserPayment.findOne({
        customerId: req.params.customerId
      }).sort({ createdAt: -1 });

      await UserPayment.create({
        type: "deposit",
        shopId: shopId,
        customerId: req.params.customerId,
        attendantId,
        totalAmount: wallet,
        balance: (lastPayment?.balance ?? 0) + wallet
      });
      //clear random credit receipt
      let customer = await paySaleThroughWallet(req.params.customerId, shopId, wallet, attendantId, payment_method)
      res.json(customer);
    } else {
      const customer = await Customer.findByIdAndUpdate(
        req.params.customerId,
        { name, shopId, attendantId, phonenumber, email, address, creditLimit },
        { new: true }
      );
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

const paySaleThroughWallet = async (customerId, shopId, amountToPay, attendantId, payment_method = "cash") => {
  let remainingAmount = amountToPay;
  let totalPaid = 0;

  let iterations = 0;

  while (remainingAmount > 0) {
    iterations++;
    if (iterations > 50) break; // safety valve

    const sale = await sales.findOne({
      shopId: new ObjectId(shopId),
      customerId: new ObjectId(customerId),
      paymentType: "credit",
      outstandingBalance: { $gt: 0 }
    }).sort({ createdAt: 1 });

    if (!sale) break;

    const unpaid = sale.outstandingBalance;
    if (unpaid <= 0) break;

    const payAmount = Math.min(remainingAmount, unpaid);
    if (payAmount <= 0) break;

    sale.payments.push({
      amount: payAmount,
      attendantId,
      paymentNo: `REC${Date.now()}`,
      balance: unpaid - payAmount,
      paymentType: payment_method.toLowerCase(),
    });

    sale.outstandingBalance -= payAmount;
    await sale.save();

    remainingAmount -= payAmount;
    totalPaid += payAmount;
  }


  // Now add to wallet: total paid toward debts + any leftover becomes credit
  const customer = await Customer.findById(customerId);
  const totalCredit = totalPaid + remainingAmount;
  const newWallet = (customer.wallet ?? 0) + totalCredit;

  return await Customer.findByIdAndUpdate(
    customerId,
    { $set: { wallet: newWallet } },
    { new: true }
  );
};


// Delete a customer by ID
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    if (customer?.wallet < 0) {
      res.json({ message: "Customer has uncleared deabt" });
    }
    await Customer.findByIdAndDelete(req.params.customerId);
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; // Retrieve all customers
const getAllCustomers = async (req, res) => {
  console.log("getAllCustomers");
  let { shopId, name, owner, type } = req.query;
  let filter = {};
  if (name) {
    filter.name = { $regex: name, $options: "i" };
  }
  // use owner or shopId to filter customers
  if(owner && shopId) {
    filter.$or = [
      { owner: owner },
      { shopId: new mongoose.Types.ObjectId(shopId) }
    ];
  }else if (shopId) {
    filter.shopId = new mongoose.Types.ObjectId(shopId)
  } else if(owner) {
    filter.owner = owner;
  }

  if(type == "debtors") {
    filter.wallet = { $lt: 0 };
  }
  console.log("getAllCustomers filter", filter);
  try {

    const result = await Customer.find(filter);
    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};


const deleteCustomerPayment = async (req, res) => {
  try {
    const { id, } = req.params;
    const { receiptId } = req.query;
    console.log(id, receiptId);
    const sale = await Sale.findByIdAndUpdate(
      id,
      {
        $pull: { payments: { _id: receiptId } },
      },
      { new: true }
    );
    await UserPayment.findByIdAndDelete(receiptId);
    let response = await getPayments(req, res);
    return response;
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const { type } = req.query;
    let payments;
    if (type == "all") {
      payments = await UserPayment.find({
        customerId: new ObjectId(req.params.customerId),
      })
        .populate({ path: "attendantId", select: "username" })
        .populate({ path: "customerId", select: "name wallet" })
        .sort({ createdAt: -1 });
    } else if (type == "earnings") {
      payments = await UserPayment.find({
        type,
        user: new ObjectId(req.params.customerId),
      })
        .populate({ path: "attendantId", select: "username" })
        .populate({ path: "user", select: "name" })
        .sort({ createdAt: -1 });

    } else {

      payments = await UserPayment.find({
        type,
        customerId: new ObjectId(req.params.customerId),
      })
        .populate({ path: "attendantId", select: "username" })
        .populate({ path: "customerId", select: "name wallet" })
        .sort({ createdAt: -1 });
    }
    return res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Retrieve a single customer by ID
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Retrieve a single customer by ID
const getCustomerNo = async (req, res) => {
  try {
    let { customerno, otp } = req.query;
    let filter = {};
    if (customerno) {
      filter.customerNo = customerno;
    }
    if (otp) {
      filter.otp = otp;
    }
    const customer = await Customer.find(filter);
    console.log(customer);
    if (customer.length == 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (otp) {
      if (isOtpExpired(customer[0].otp_expiry)) {
        return res.status(401).json({ error: "Otp has expired", retry: false });
      }
      if (otp != customer[0].otp) {
        return res.status(401).json({ error: "invalid otp", retry: true });
      }
    }
    if (customer[0].email == null) {
      return res.status(401).json({ error: "sorry, customer email is null or not valid", retry: true });
    }

    if (customerno) {
      let otp = generateOTP();
      let otp_expiry = calculateOtpExpirationTime(5);
      customer[0].otp = otp;
      customer[0].otp_expiry = otp_expiry;
      await customer[0].save();


      const replacements = {
        username: customer[0].name,
        otp,
      };
      sendEmail(customer[0].email, 'Order Access OTP', 'ordersotp', replacements);
    }


    res.json(customer[0]);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: error.message });
  }
};
const getAllDebstors = async (req, res) => {
  console.log("getAllDebstors")
  try {
    const shopId = req.query.shopId;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);

    const pipeline = [
      { $match: { shopId: new mongoose.Types.ObjectId(shopId) } },
      {
        $lookup: {
          from: 'sales',
          localField: '_id',
          foreignField: 'customerId',
          as: 'salesData'
        }
      },
      {
        $addFields: {
          totalDebt: { $sum: '$salesData.outstandingBalance' },
          totalPaid: { $sum: '$salesData.amountPaid' }
        }
      },
      {
        $match: {
          totalDebt: { $gt: 0 }
        }
      },
      {
        $project: {
          salesData: 0
        }
      }
    ];

    // Clone the pipeline to compute total debt
    const totalPipeline = [...pipeline,
    {
      $group: {
        _id: null,
        totalDebtSum: { $sum: "$totalDebt" }
      }
    }
    ];

    // Compute the total debt sum for all debtors
    const totalDebtResult = await Customer.aggregate(totalPipeline);
    const totalDebtSum = totalDebtResult[0]?.totalDebtSum || 0;

    // Only apply pagination if both page and limit are valid positive integers
    if (!isNaN(page) && page > 0 && !isNaN(limit) && limit > 0) {
      const skip = (page - 1) * limit;
      console.log(`Pagination -> PAGE: ${page}, LIMIT: ${limit}, SKIP: ${skip}`);
      pipeline.push({ $skip: skip }, { $limit: limit });
    }

    // Execute main query
    const result = await Customer.aggregate(pipeline);

    if (result.length === 0) {
      return res.status(404).json({ message: 'No customers with debt found.' });
    }

    res.json({
      total: totalDebtSum,
      data: result,
      page: (!isNaN(page) && page > 0) ? page : null,
      limit: (!isNaN(limit) && limit > 0) ? limit : null
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
const getAllDebstorsExcel = async (req, res) => {
  try {
    const result = await Customer.aggregate([
      { $match: { shopId: new mongoose.Types.ObjectId(req.query.shopId) } },
      {
        $lookup: {
          from: 'sales',
          localField: '_id',
          foreignField: 'customerId',
          as: 'salesData'
        }
      },
      {
        $addFields: {
          totalDebt: {
            $sum: '$salesData.outstandingBalance'
          },
          totalPaid: {
            $sum: '$salesData.amountPaid'
          }
        }
      },
      {
        $match: {
          totalDebt: { $gt: 0 }
        }
      },
      {
        $project: {
          salesData: 0
        }
      }
    ]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'No customers with debt found.' });
    }

    // Calculate total debt
    const totalDebtSum = result.reduce((acc, customer) => acc + customer.totalDebt, 0);

    // Create a new Excel workbook and sheet
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers with Debt');

    // Add headers to the sheet
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Phone Number', key: 'phonenumber', width: 20 },
      { header: 'Total Debt', key: 'totalDebt', width: 15 },
      { header: 'Total Paid', key: 'totalPaid', width: 15 }
    ];

    // Add rows to the sheet
    result.forEach(customer => {
      worksheet.addRow(customer);
    });

    // Add total debt row at the bottom
    const totalDebtRow = worksheet.addRow({
      _id: '',
      name: 'Total Debt',
      totalDebt: totalDebtSum,
      totalPaid: ''
    });

    // Make the total debt row bold
    totalDebtRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Set response headers to download the file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=customers_with_debt.xlsx`);
    console.log(res);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
const importCustomers = async (req, res) => {
  console.log("importCustomers")
  try {
    let { customers } = req.body;
    let successCount = 0;
    let failCount = 0;
    let productsFailed = [];
    console.log("importCustomers", customers)

    const promises = customers.map(async (i) => {
      try {
        // Find the category by name
        if (i.debt && i.debt > 0) {
          i.wallet -= i.debt;
        }
        const customer = await Customer.findOneAndUpdate(
          { name: i.name, shopId: i.shopId },
          i,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        successCount++;
      } catch (error) {
        productsFailed.push(i.name);
        console.error(`Failed to import product: ${i.name}`, error);
        failCount++;
      }
    });

    // Wait for all product creations to complete
    await Promise.all(promises);
    console.log(productsFailed);
    res.status(200).json({
      message: `Imported ${successCount} customers, ${failCount} failed.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getOverdueCustomers = async (req, res) => {
  let { shopId } = req.params;
  try {
    const now = new Date();
    const objectId = new mongoose.Types.ObjectId(shopId);

    // Find all overdue sales
    const overdueSales = await Sale.find({
      shopId: objectId,
      paymentType: "credit",
      duedate: { $lte: now },
      outstandingBalance: { $gte: 0 },
    }).populate("customerId").lean();

    // Group by customer
    const overdueByCustomer = overdueSales.reduce((acc, sale) => {
      if (!sale.customerId) return acc;
      const custId = sale.customerId._id.toString();

      if (!acc[custId]) {
        acc[custId] = {
          customerId: custId,
          name: sale.customerId.name,
          phonenumber: sale.customerId.phonenumber,
          totalOverdue: 0,
          dueCount: 0,
          latestDue: null,
        };
      }

      acc[custId].totalOverdue += sale.outstandingBalance || 0;
      acc[custId].dueCount += 1;

      if (!acc[custId].latestDue || sale.duedate > acc[custId].latestDue) {
        acc[custId].latestDue = sale.duedate;
      }

      return acc;
    }, {});

    return res.json(Object.values(overdueByCustomer).sort((a, b) => b.totalOverdue - a.totalOverdue));
  } catch (error) {
    console.error("Error fetching overdue customers:", error);
    return res.json({ error: "Failed to get overdue customers" });
  }
}

const getCustomerAnalysis = async (req, res) => {
  let { shopId } = req.params;
  try {
    const objectId = new mongoose.Types.ObjectId(shopId);

    // 1. Basic stats
    const customers = await Customer.find({ shopId: objectId }).lean();
    const totalCustomers = customers.length;

    const totalWalletBalance = customers.reduce((sum, customer) => sum + (customer.wallet || 0), 0);

    // 2. Total outstanding from sales
    const sales = await Sale.find({ shopId: objectId, customerId: { $ne: null } }).populate("customerId").lean();
    console.log(sales)
    const customerSales = sales.reduce((acc, sale) => {
      const custId = sale.customerId?._id.toString();
      if (!acc[custId]) {
        acc[custId] = {
          name: sale.customerId?.name,
          phonenumber: sale.customerId?.phonenumber,
          totalOutstanding: 0,
          totalSpent: 0,
        };
      }

      acc[custId].totalOutstanding = sale.outstandingBalance || 0;
      acc[custId].totalSpent = sale.totalWithDiscount || 0;
      return acc;
    }, {});

    // 3. Summary calculations
    const totalOutstanding = Object.values(customerSales).reduce((sum, c) => sum + c.totalOutstanding, 0);
    const avgOutstanding = totalCustomers ? totalOutstanding / totalCustomers : 0;

    const topDebtors = Object.values(customerSales)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 5);

    return res.json({
      shopId,
      totalCustomers,
      totalWalletBalance,
      totalOutstanding,
      avgOutstandingPerCustomer: avgOutstanding.toFixed(2),
      topDebtors,
    });

  } catch (err) {
    console.error("Error fetching customer analysis:", err);
    return res.json({ error: "Failed to get customer analysis" });
  }
}


module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getPayments,
  customerVerify,
  getCustomerNo,
  getAllDebstors,
  getAllDebstorsExcel,
  importCustomers,
  deleteCustomerPayment,
  getCustomerAnalysis,
  getOverdueCustomers
};
