const Purchase = require("../models/purchase");
const Supplier = require("../models/supplier");
const UserPayment = require("../models/payment");
const { handleValidationErrors } = require("../shared/validationUtils");
const sales = require("../models/sales");
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");
const Customer = require("../models/customer");
const mongoose = require("mongoose");
const awardPayments = require("../models/awards");
const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;
const functions = require("../shared/functions");
const Affliate = require("../models/affliate");
const Transaction = require("../models/transactions");
const Subscription = require("../models/subscription");

exports.checkpaymentstatus = async (req, res) => {
  try {
    const { reference } = req.query;
    const subscription = await Subscription.findOne({ _id: reference, paid: true }).populate("packageId");
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    return res.status(200).json({ status: "success", data: subscription });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

const calculateTotalPayments = (purchase) => {
  let totalPayments = 0;

  if (purchase.payments && purchase.payments.length > 0) {
    purchase.payments.forEach((payment) => {
      totalPayments += payment.amount;
    });
  }

  return totalPayments;
};

exports.recordPurchasePayment = async (req, res) => {
  try {
    const { purchaseId, paymentAmount, attendantId } = req.body;


    // Find the purchase by ID
    const purchase = await Purchase.findById(purchaseId);

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    if (purchase.paymentType != "credit") {
      return res.status(400).json({
        error: "Payments can only be recorded for purchases made on credit",
      });
    }

    if (purchase.outstandingBalance <= 0) {
      return res
        .status(400)
        .json({ error: "This purchase is already fully paid." });
    }
    // Calculate the outstanding balance
    const outstandingBalance =
      purchase.totalAmount - calculateTotalPayments(purchase);

    if (paymentAmount > outstandingBalance) {
      return res.status(400).json({
        error: "You can only pay amount equal to outstanding balance or less",
      });
    }

    // Check if the payment amount is valid
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    purchase.outstandingBalance -= paymentAmount;

    if (paymentAmount > 0) {
      await Supplier.findByIdAndUpdate(
        purchase.supplierId,
        {
          $inc: { wallet: paymentAmount },
        },
        { new: true }
      ).catch((err) => {
        console.error("Failed to update supplier wallet:", err);
      });
    }

    const prefix = "REC"; // Customize the prefix as needed
    const randomPart = Math.floor(1000 + Math.random() * 9000);

    // Record the payment
    purchase.payments.push({
      amount: paymentAmount,
      attendantId,
      paymentNo: `${prefix}${randomPart}`,
      balance: purchase.outstandingBalance,
    });

    // Update the outstanding balance

    // Save the purchase with the recorded payment
    await purchase.save();
    if (purchase.supplierId) {
      UserPayment.create({
        type: "payment",
        shopId: purchase.shopId,
        supplierId: purchase.supplierId,
        attendantId,
        totalAmount: paymentAmount,
        balance: purchase.outstandingBalance,
      });
    }

    res.status(200).json(purchase);
  } catch (error) {
    handleValidationErrors(error, res);
  }
};
exports.recordSalePayment = async (req, res) => {
  try {
    const { saleId, paymentAmount, attendantId, paymentType, reason,mpesaCode } = req.body;
    const sale = await sales.findById(saleId).populate("customerId", "wallet");
    console.log(req.body)
    console.log(sale)

    if (!sale) {
      return res.status(404).json({ error: "sale not found" });
    }

    if (sale.paymentType != "credit") {
      return res.status(400).json({
        error: "Payments can only be recorded for sales made on credit",
      });
    }

    const outstandingBalance = sale.totalAmount - calculateTotalPayments(sale);
    if (outstandingBalance <= 0) {
      return res
        .status(400)
        .json({ error: "This sale is already fully paid." });
    }
    // Calculate the outstanding balance
    console.log(outstandingBalance);
    // const amountPaid = paymentAmount;
    sale.amountPaid = paymentAmount + sale.amountPaid;
    if (paymentAmount > outstandingBalance) {
      return res.status(400).json({
        error: "You can only pay amount equal to outstanding balance or less",
      });
    }

    // Check if the payment amount is valid
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }
      if (paymentType == "Wallet") { 
        const customer = await Customer.findById(sale.customerId);
        if (
          customer.wallet == 0 ||
          customer.wallet < 0 ||
          customer.wallet < paymentAmount
        ) {
          return res
            .status(400)
            .json({ error: "customer has no enough balance in the wallet" });
        }
        let walletbalance = customer.wallet - paymentAmount;
        customer.wallet = walletbalance;
        customer.save();
      }


    const prefix = "REC"; // Customize the prefix as needed
    const randomPart = Math.floor(1000 + Math.random() * 9000);

    sale.payments.push({
      amount: paymentAmount,
      attendantId,
      paymentNo: `${prefix}${randomPart}`,
      balance: outstandingBalance - paymentAmount,
      mpesaCode,
      paymentType: paymentType.toLowerCase()
    });

    // Save the sale with the recorded payment
    if (sale.customerId) {
      let newbalance = sale.customerId?.wallet > 0 ? sale.customerId?.wallet - paymentAmount : sale.customerId?.wallet + paymentAmount;
      await UserPayment.create({
        type: "payment",
        shopId: sale.shopId,
        customerId: sale.customerId?._id,
        attendantId,
        totalAmount: paymentAmount,
        balance: newbalance,
        mpesaCode,
        paymentType: paymentType.toLowerCase()
      });
      await Customer.findByIdAndUpdate(
        sale.customerId?._id,
        {
          $set: { wallet: newbalance }
        },
        { new: true } 
      )
    }
    sale.outstandingBalance = outstandingBalance - paymentAmount;
    await sale.save();
    res.status(200).json(sale);
  } catch (error) {
    handleValidationErrors(error, res);
  }
};
exports.getPaymentsByPurchaseIdOrSaleId = async (req, res) => {
  try {
    const {
      purchaseId,
      saleId,
      fromDate,
      toDate,
      shop,
      page,
      limit,
      search,
    } = req.query;

    if (purchaseId) {
      const purchase = await Purchase.findById(purchaseId).populate({
        path: "payments.attendantId",
        select: "username",
      });

      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      return res.status(200).json(purchase.payments);
    }

    if (saleId) {
      const sale = await sales
        .findById(saleId)
        .populate({
          path: "payments.attendantId",
          select: "username",
        })
        .populate({
          path: "customerId",
          select: "name phone email wallet",
        });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      const payments = sale.payments.map((payment) => ({
        ...payment.toObject(),
        customerId: sale.customerId
          ? {
            name: sale.customerId.name,
            phone: sale.customerId.phone,
            email: sale.customerId.email,
            wallet: sale.customerId.wallet,
          }
          : null,
      }));

      return res.status(200).json(payments);
    }

    if (fromDate && toDate) {
      const filter = {
        createdAt: {
          $gte: fromDateFormat(fromDate),
          $lte: toDateFormat(toDate),
        },
        type: {
          $in: ["payment", "deposit"],
        },
        shopId: new mongoose.Types.ObjectId(shop),
      };

      // Search by customer name or phone
      if (search && search.trim()) {
        const customers = await Customer.find({
          $or: [
            { name: { $regex: search.trim(), $options: "i" } },
            { phone: { $regex: search.trim(), $options: "i" } },
          ],
        }).select("_id");

        filter.customerId = {
          $in: customers.map((customer) => customer._id),
        };
      }

      const query = UserPayment.find(filter)
        .populate({
          path: "attendantId",
          select: "username",
        })
        .populate({
          path: "customerId",
          select: "name phone",
        })
        .sort({ createdAt: -1 });

      // Apply pagination only if page or limit is provided
      if (page || limit) {
        const pageNumber = parseInt(page || 1);
        const limitNumber = parseInt(limit || 20);
        const skip = (pageNumber - 1) * limitNumber;

        query.skip(skip).limit(limitNumber);

        const [payments, total] = await Promise.all([
          query,
          UserPayment.countDocuments(filter),
        ]);

        return res.status(200).json({
          data: payments,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber),
            hasNextPage: pageNumber * limitNumber < total,
            hasPrevPage: pageNumber > 1,
          },
        });
      }

      // No pagination requested
      const payments = await query;

      return res.status(200).json(payments);
    }

    return res.status(400).json({
      error:
        "Either purchaseId, saleId, or fromDate and toDate must be provided",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

exports.deleteReceiptById = async (req, res) => {
  const { id } = req.params;
  const { saleId } = req.body;

  try {
    const purchase = await sales.findByIdAndUpdate(
      saleId,
      {
        $pull: { payments: { _id: id } }
      },
      { new: true } // Return the updated document after the operation
    ).exec();

    return res.status(200).json(purchase); // No content in the response.
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteReceipt = async (req, res) => {
  const { id } = req.params;
  const { saleId } = req.body;

  try {
    const purchase = await sales.findByIdAndUpdate(
      saleId,
      {
        $pull: { payments: { _id: id } }
      },
      { new: true } // Return the updated document after the operation
    ).exec();

    return res.status(200).json(purchase); // No content in the response.
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
exports.getAwardsPayments = async (req, res) => {
  try {
  const { user, type, page, limit } = req.query;

  // Convert page and limit to integers and calculate skip if page is provided
  const pageInt = parseInt(page) || 0;
  const limitInt = parseInt(limit) || 10;
  const skip = page ? (pageInt - 1) * limitInt : 0;

  // Define the base query
  let paymentsQuery = awardPayments.find({
    user: new ObjectId(user),
  })
    .populate({ path: "user", select: "name" })
    .populate({ path: "shops", select: "name" })
    .populate({ path: "shop", select: "name" })
    .sort({ createdAt: -1 });

  // Apply pagination if 'page' is passed
  if (page) {
    paymentsQuery = paymentsQuery.skip(skip).limit(limitInt);
  }

  const payments = await paymentsQuery;

  if (page) {
    // Get total count for pagination
    const totalPayments = await awardPayments.countDocuments({ user: new ObjectId(user) });
    const totalPages = Math.ceil(totalPayments / limitInt);

    res.json({
      data: payments,
      count: totalPayments,
      totalPages,
      currentPage: pageInt,
    });
  } else {
    res.json(payments);
  }
} catch (error) {
  res.status(500).json({ error: error.message });
}

};
exports.withdrawResponse = async (req, res) => {
  console.log(req.body['Result']['ResultParameters']['ResultParameter'])
  var transactionID = req.body['Result']['TransactionID'];
  console.log(req.body)
  var transid = req.query.transid;
  let transactions = await Transaction.find({ mpesaCode: transactionID, status:true });
  if (transactions.length > 0) {
    return;
  }
  await Transaction.findOneAndUpdate({ _id: transid }, { mpesaCode: transactionID, status: true });
}

exports.transactions = async (req, res) => {
  try {
    const { id, page = 1, limit = 30 } = req.query;

    // Convert strings to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const match = {};
    if (id) {
      match.affliate = id;
    }

    // Count total (before pagination)
    const total = await Transaction.countDocuments(match);

    // Fetch paginated data
    const transactions = await Transaction.find(match)
      .populate("affliate")
      .populate("user", "username phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      data: transactions
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.withdrawAmountMpesa = async (req, res) => {
  console.log(req.body)
  let {amount, phonenumber, pin, id, transactionId} = req.body;
  if(pin !="1122"){
    return res.json({ status: false, message: "Invalid Pin"})
  }
  if(id && transactionId){
    let transactoinResponse = await Transaction.findOne({ _id: new ObjectId(transactionId) });
    if(!transactoinResponse){
      return res.json({ status: false, message: "Transaction not found"})
    }
    var data = {
      amount: amount,
      phone: phonenumber,
      call_back: process.env.MPESA_DEPOSIT_CALLBACK,
      transid: transactionId,
      userid: id
    };
    await functions.callWithdrawApi(data);
    return res.json({ status: true, message: "Withdraw Request sent successfully"})
  }
  amount = parseInt(amount);
  const transactoinResponse = await Transaction.create({
    amount: amount,
    balance: 0,
    type: "withdraw",
    status: false
  })

  var data = {
    amount: amount,
    phone: phonenumber,
    call_back: process.env.MPESA_DEPOSIT_CALLBACK,
    transid: transactoinResponse._id
  };
  await functions.callWithdrawApi(data);
  res.json({ status: true, message: "Withdraw Request sent successfully"})
} 
exports.withdrawAmount = async (req, res) => {
  let userid = req.params.id;
  let userAccount = await Affliate.findOne(new mongoose.Types.ObjectId(userid));
  if (userid) {
    if (userAccount.wallet <= 0 || userAccount.wallet < req.body.amount ) {
      return res.json({ status: false, message: "You have no enough balance to withdraw KES" + req.body.amount})
    }

    if(userAccount?.blocked ==true){
      return res.json({ status: false, message: "This account is blocked for 30 - 45 days, due to violation of our terms and conditions"})
    }
  }
  let balance = userAccount.wallet - req.body.amount;
  const transactoinResponse = await Transaction.create({
    amount: req.body.amount,
    balance: balance,
    type: "withdraw",
    affliate: userid,
    status: false
  })
  var data = {
    amount: req.body.amount,
    phone: req.body.phonenumber,
    call_back: process.env.MPESA_DEPOSIT_CALLBACK,
    transid: transactoinResponse._id,
    userid: userid
  };
  await functions.callWithdrawApi(data);
  userAccount.wallet = userAccount.wallet - req.body.amount;
  userAccount.save();
  res.json({ status: true, message: "Withdraw Request sent successfully"})
} 

exports.withdrawElimu = async (req, res) => {
  try {
    console.log(req.body)
    let { id, amount, phoneNumber } = req.body;
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    var data = {
      amount,
      phone: phoneNumber,
      call_back: process.env.MPESA_DEPOSIT_CALLBACK,
      transid: "elimu_" + randomPart,
      userid: id
    };
    let response = await functions.callWithdrawApi(data);
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({success: false})
  } 
}

exports.b2c = async (req, res) => {
  var response = await functions.b2c();
  console.log(response);
  res.json(response)
}

