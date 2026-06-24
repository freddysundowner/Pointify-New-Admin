const Admin = require("../models/admin"); // Adjust the import path as needed
const bcrypt = require("bcryptjs");
const Subscription = require("../models/subscription");

const Shop = require("../models/shop");
const CashFlowCategory = require("../models/cashflowcategory");
const mongoose = require("mongoose"); // Import the mongoose module
const ExpenseCategory = require("../models/expensecategory");
const sales = require("../models/sales");
const Customers = require("../models/customer")
const supplier = require("../models/supplier")
const cashflow = require("../models/cashflow")
const count = require("../models/count")
const badstock = require("../models/badstock")
const bank = require("../models/bank")
const expenses = require("../models/expenses")
const payment = require("../models/payment")
const product = require("../models/product")
const purchase = require("../models/purchase")
const purchaseitem = require("../models/purchaseitem")
const saleitem = require("../models/saleitem")
const salereturns = require("../models/salereturns")
const transfer = require("../models/transfer")
const attendant = require("../models/attendant")
const transporter = require("../shared/emailsetup"); // Import your Nodemailer setup
const jwt = require('jsonwebtoken');
const { sendEmailNew } = require("../shared/emailsetup");

const permissions = (req, res) => {
  return res.json([
    {
      "key": "pos",
      "value": [
        "set_sale_date",
        'can_sell',
        'can_sell_to_dealer_&_wholesaler',
        'discount',
        "edit_price",
      ],
    },
    {
      "key": "stocks",
      "value": [
        'view_products',
        'add_products',
        "view_buying_price",
        'stock_summary',
        'view_purchases',
        'add_purchases',
        'stock_count',
        'badstock',
        'transfer',
        'return',
        'delete_purchase_invoice',
      ],
    },
    {
      "key": "products",
      "value": [
        'edit',
        'delete',
        'add',
        "adjust_stock",
        "view_adjustment_history",
        "view_history"
      ],
    },
    {
      "key": "sales",
      "value": ['view_sales', "return", "delete", "view_profit", "view_summary"],
    },
    {
      "key": "reports",
      "value": [
        'sales',
        "dues",
        "productsales",
        "discoutedsales",
        "debtors",
        "purchases",
        "expenses",
        "stocktake",
        "netprofit",
        'stockreport',
        "productmovement",
        "profitanalysis"
      ],
    },
    {
      "key": "purchases",
      "value": ['edit_buying_price'],
    },
    {
      "key": "accounts",
      "value": [
        'cashflow',
      ],
    },
    {
      "key": "expenses",
      "value": [
        'manage',
      ],
    },
    {
      "key": "suppliers",
      "value": ['manage']
    },
    {
      "key": "customers",
      "value": ['manage', 'deposit']
    },
    {
      "key": 'shop',
      "value": ["manage", "switch"],
    },
    {
      "key": 'attendants',
      "value": ["manage", "view"],
    },
    {
      "key": 'usage',
      "value": ["manage"],
    },
    {
      "key": 'support',
      "value": ["manage"],
    },
  ])
}
const getAdmins = async (req, res) => {
  try {
    let {
      affliate,
      page = 1,
      limit = 50,
      name,
    } = req.query;

    const filter = {};

    // affiliate filter
    if (
      affliate &&
      mongoose.Types.ObjectId.isValid(affliate)
    ) {
      filter.affliate =
        new mongoose.Types.ObjectId(affliate);
    }

    // search filter
    if (name?.trim()) {
      filter.$or = [
        {
          username: {
            $regex: name.trim(),
            $options: "i",
          },
        },
        {
          email: {
            $regex: name.trim(),
            $options: "i",
          },
        },
        {
          phone: {
            $regex: name.trim(),
            $options: "i",
          },
        },
      ];
    }

    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 50;

    const skip = (pageInt - 1) * limitInt;

    const pipeline = [
      {
        $match: filter,
      },

      // lightweight shops list
      {
        $lookup: {
          from: "shops",
          let: {
            adminId: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$adminId", "$$adminId"],
                },
              },
            },

            {
              $project: {
                _id: 1,
                name: 1,
                contact: 1,
                currency: 1,
                warehouse: 1,
                production: 1,
                createAt: 1,
              },
            },
          ],
          as: "shops",
        },
      },

      // detailed primary shop
      {
        $lookup: {
          from: "shops",
          let: {
            shopId: "$primaryShop",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$shopId"],
                },
              },
            },

            // populate subscription
            {
              $lookup: {
                from: "subscriptions",
                let: {
                  subscriptionId: "$subscription",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$subscriptionId"],
                      },
                    },
                  },

                  // populate package
                  {
                    $lookup: {
                      from: "packages",
                      localField: "packageId",
                      foreignField: "_id",
                      as: "package",
                    },
                  },

                  {
                    $unwind: {
                      path: "$package",
                      preserveNullAndEmptyArrays: true,
                    },
                  },

                  {
                    $project: {
                      _id: 1,
                      amount: 1,
                      status: 1,
                      paid: 1,
                      startDate: 1,
                      endDate: 1,
                      type: 1,
                      currency: 1,

                      package: {
                        _id: 1,
                        name: 1,
                        price: 1,
                        duration: 1,
                        type: 1,
                      },
                    },
                  },
                ],
                as: "subscription",
              },
            },

            {
              $unwind: {
                path: "$subscription",
                preserveNullAndEmptyArrays: true,
              },
            },

            {
              $project: {
                _id: 1,
                name: 1,
                contact: 1,
                currency: 1,
                warehouse: 1,
                production: 1,
                createAt: 1,
                subscription: 1,
              },
            },
          ],
          as: "primaryShop",
        },
      },

      {
        $unwind: {
          path: "$primaryShop",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $addFields: {
          shopCount: {
            $size: "$shops",
          },
        },
      },

      // latest first
      {
        $sort: {
          _id: -1,
        },
      },

      {
        $skip: skip,
      },

      {
        $limit: limitInt,
      },
    ];

    const admins = await Admin.aggregate(pipeline);

    const totalAdmins =
      await Admin.countDocuments(filter);

    return res.status(200).json({
      data: admins,
      count: totalAdmins,
      totalPages: Math.ceil(
        totalAdmins / limitInt
      ),
      currentPage: pageInt,
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
const getLocalAdmin = async (req, res) => {
  const admin = await Admin.findOne().populate({ path: "primaryShop", populate: { path: "subscription", populate: { path: "packageId" } } }).populate('attendantId');
  return res.json(admin);
}
const updateAdmin = async (req, res) => {
  try {
    const adminId = req.params.id;
    const { username, password, shop, phone, emailVerified, phoneVerified, email, lastAppRatingDate, status, saleSmsEnabled, saleSmsSender, saleSmsTemplate } = req.body;
    console.log(req.body);

    // Find the admin by ID
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    let update = {};

    // Update the fields you want to change
    if (username) {
      update.username = username;
    }
    if (saleSmsEnabled || !saleSmsEnabled) {
      update.saleSmsEnabled = saleSmsEnabled
    }
    if (saleSmsSender) {
      update.saleSmsSender = saleSmsSender
    }
    if (saleSmsTemplate) {
      update.saleSmsTemplate = saleSmsTemplate
    }
    if (status) {
      update.status = status;
    }
    if (shop) {
      update.primaryShop = shop;
    }
    if (emailVerified) {
      update.emailVerified = emailVerified;
    }
    if (phoneVerified) {
      update.phoneVerified = phoneVerified;
    }
    if (phone) {
      update.phone = phone;
    }
    if (email) {
      update.email = email;
    }
    if (lastAppRatingDate) {
      update.lastAppRatingDate = lastAppRatingDate;
    }
    console.log(update);
    if (password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(password, salt);
    }
    const updatedAdmin = await Admin.findByIdAndUpdate(adminId, update, {
      new: true,
    }).populate({ path: "primaryShop", populate: { path: "subscription", populate: { path: "packageId" } } }).populate('attendantId');


    return res.json(updatedAdmin);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyValue && error.keyValue.email) {
      const duplicateEmail = error.keyValue.email;
      const friendlyErrorMessage = `Oops! It seems that there's already an admin account associated with the email address ${duplicateEmail}. Please double-check the email address you entered or try using a different one. If you believe this is an error, please reach out to our support team for assistance.`;
      // console.error(friendlyErrorMessage);
      return res.status(200).json({ error: friendlyErrorMessage });
      // You can also send this friendly error message as a response to the client if it's a web application
    } else {
      console.error("An unexpected error occurred:", error);
      return res.status(200).json({ error: error });
      // Handle other types of errors
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};
function generateVerificationToken(userid) {
  return signedToken = jwt.sign({ id: userid }, process.env.jwtsecret);
}
const sendverificationemail = async (req, res) => {
  try {
    let { userid } = req.body;
    let verificationToken = generateVerificationToken(userid);
    const admin = await Admin.findById(userid);
    admin.verificationToken = verificationToken;
    await admin.save();
    const verificationLink = `https://pointifypos.com/verify?token=${verificationToken}`;

    await sendEmailNew({
      recipientEmail: admin.email,
      recipientName: admin.username,
      subject: 'Email Verification',
      slug: 'email-verification',
      placeholders: {
        name: admin.username,
        verificationLink: verificationLink,
      }
    });
    res.json({ message: `Email verification link sent to your email (${admin.email}), please open your mailbox and click the link sent then come back to the app and refresh` })
  } catch (e) {
    res.json({ error: "Error sending verification" })
  }
}

const verifyemail = async (req, res) => {
  console.log(req.body)
  const decodedToken = jwt.decode(req.body.token);

  jwt.verify(req.body.token, process.env.jwtsecret, async (err, decoded) => {
    if (err) {
      // Token verification failed (e.g., expired or invalid)
      console.error('Token verification failed:', err.message);
    } else {
      // Token verification succeeded
      console.log('Decoded payload:', decoded);

      // Check if the token has expired
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      if (decoded.iat && now > decoded.iat + (60 * 60 * 24)) {
        // Token has expired (assuming a 24-hour expiration)
        console.log('Token has expired');
        return res.json({ message: 'Token has expired', status: false })
      } else {
        // Token is still valid
        const admin = await Admin.findById(decoded.id);
        admin.emailVerified = true;
        admin.save();
        console.log('Token is still valid', admin);
        return res.json({ message: "Email Verified", status: true })
      }
    }
  });

}

getAdminsBySubscriptionStatus = async (req, res) => {
  try {
    let {
      subscriptionStatus, // active | expired
      subscriptionType,   // trial | production
      page = 1,
      limit = 10,
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;
    const now = new Date();

    const pipeline = [];

    /* ================= BASE ================= */
    pipeline.push({
      $match: {
        primaryShop: { $ne: null },
      },
    });

    /* ================= PRIMARY SHOP ================= */
    pipeline.push({
      $lookup: {
        from: "shops",
        localField: "primaryShop",
        foreignField: "_id",
        as: "shop",
      },
    });

    pipeline.push({
      $unwind: {
        path: "$shop",
        preserveNullAndEmptyArrays: false,
      },
    });

    /* ================= SUBSCRIPTION ================= */
    pipeline.push({
      $lookup: {
        from: "subscriptions",
        localField: "shop.subscription",
        foreignField: "_id",
        as: "subscription",
      },
    });

    pipeline.push({
      $unwind: {
        path: "$subscription",
        preserveNullAndEmptyArrays: true,
      },
    });

    /* ================= PACKAGE ================= */
    pipeline.push({
      $lookup: {
        from: "packages",
        localField: "subscription.packageId",
        foreignField: "_id",
        as: "package",
      },
    });

    pipeline.push({
      $unwind: {
        path: "$package",
        preserveNullAndEmptyArrays: true,
      },
    });

    /* ================= NORMALIZE STATUS ================= */
    pipeline.push({
      $addFields: {
        isActive: {
          $cond: [
            { $gte: ["$subscription.endDate", now] },
            true,
            false,
          ],
        },
        packageType: "$package.type",
      },
    });

    /* ================= APPLY FILTERS ================= */
    const match = {};

    if (subscriptionStatus === "active") {
      match.isActive = true;
    }

    if (subscriptionStatus === "expired") {
      match.isActive = false;
    }

    if (subscriptionType) {
      match.packageType = subscriptionType;
    }

    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }

    /* ================= PROJECT (CLEAN RESPONSE) ================= */
    pipeline.push({
      $project: {
        _id: 1,
        email: 1,
        phone: 1,
        createdAt: 1,
        primaryShop: {
          _id: "$shop._id",
          name: "$shop.name",
        },
        subscription: {
          _id: "$subscription._id",
          endDate: "$subscription.endDate",
        },
        package: {
          _id: "$package._id",
          title: "$package.title",
          type: "$package.type",
        },
        isActive: 1,
      },
    });

    /* ================= SORT + PAGINATION ================= */
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    );

    /* ================= COUNT ================= */
    const countPipeline = pipeline
      .filter(p => !p.$skip && !p.$limit && !p.$sort)
      .concat({ $count: "total" });

    const [admins, count] = await Promise.all([
      Admin.aggregate(pipeline),
      Admin.aggregate(countPipeline),
    ]);

    const totalAdmins = count[0]?.total || 0;

    res.json({
      admins,
      totalAdmins,
      totalPages: Math.ceil(totalAdmins / limit),
      currentPage: page,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const deleteAdmin = async (req, res) => {

  //delete all sales and sales items
  let shops = await Shop.find({ adminId: req.params.id });

  const promises = shops.map(async (i) => {
    let id = i._id;
    await saleitem.deleteMany({ shopId: id });
    await sales.deleteMany({ shopId: id });
    await salereturns.deleteMany({ shopId: id });

    await Subscription.deleteMany({
      userId: id
    });

    //delete all customers
    await Customers.deleteMany({ shopId: id });
    //delete all products
    await product.deleteMany({ shopId: id });

    //delete all suppliers
    await supplier.deleteMany({ shopId: id });

    //delete all purchases and purchases items
    await purchaseitem.deleteMany({ shopId: id });
    await purchase.deleteMany({ shopId: id });

    //delete all expenses
    await ExpenseCategory.deleteMany({ shopId: id });
    await expenses.deleteMany({ shopId: id });

    //delete all cashflow and cashflow categories
    await cashflow.deleteMany({ shopId: id });
    await CashFlowCategory.deleteMany({ shopId: id });

    //others
    await transfer.deleteMany({ toShopId: id });
    await transfer.deleteMany({ fromShopId: id });
    await payment.deleteMany({ shopId: id });
    await badstock.deleteMany({ shopId: id });
    await count.deleteMany({ shopId: id });
    await bank.deleteMany({ shopId: id });
    await attendant.deleteMany({ shopId: id });
    await Shop.findOneAndDelete({ shopId: id });
  });
  await Promise.all(promises);
  await Admin.findOneAndDelete({ _id: req.params.id });
  return res.json({ "message": "account deleted" });

};
const searchAdmin = async (req, res) => {
  let { text } = req.query;
  console.log(req.query);
  let response = await Admin.find({
    $or: [
      { username: { $regex: text, $options: "i" } },
      { phone: { $regex: text, $options: "i" } },
      { email: { $regex: text, $options: "i" } }
    ]
  });
  console.log(response);
  res.json(response);
}

module.exports = {
  updateAdmin,
  verifyemail,
  deleteAdmin,
  getAdmins,
  sendverificationemail,
  searchAdmin, permissions, getLocalAdmin, getAdminsBySubscriptionStatus
};
