const ShopCategory = require("../models/shopCategory");
const Admin = require("../models/admin");
const mongoose = require("mongoose"); 
const Shop = require("../models/shop");
const attendant = require("../models/attendant");
const Inventory = require("../models/inventory")
const CashFlowCategory = require("../models/cashflowcategory");
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
const purchasereturn = require("../models/PurchaseReturn")
const saleitem = require("../models/saleitem")
const salereturns = require("../models/salereturns")
const transfer = require("../models/transfer")
const Subscription = require("../models/subscription");
const Package = require("../models/package");
const { sendEmail } = require("../shared/emailsetup");
const awardsSchema = require("../models/awards");
const Product = require("../models/product");
const Affliate = require("../models/affliate");
const Setting = require("../models/Setting");
const { syncShopToSunPay, deleteShopFromSunPay } = require("../services/sunpay");
// Delete a shop by ID
const deleteShopDataById = async (req, res) => {
  const { id } = req.params;
  try {
    const shop = await Shop.findById(id).populate('adminId');
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    //delete all sales and sales items

    await saleitem.deleteMany({ shopId: id });
    await sales.deleteMany({ shopId: id });
    await salereturns.deleteMany({ shopId: id });
    await Inventory.deleteMany({ shop: id });

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
    const replacements = {
      username: shop.adminId.username,
      shopname:shop.name
    };
    sendEmail(shop.adminId.email, 'Shop Data Deleted', 'deleteshop', replacements); 
    return res.json({status: true, message: "shop data deleted"});
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Internal server error" });
  }
};
// Delete a shop by ID
const deleteShopById = async (req, res) => {
  const { id } = req.params;
  try {
    const shop = await Shop.findByIdAndRemove(id).populate('adminId');
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    //delete all sales and sales items

    await saleitem.deleteMany({ shopId: id });
    await sales.deleteMany({ shopId: id });
    await salereturns.deleteMany({ shopId: id });

    //delete all customers
    await Customers.deleteMany({ shopId: id });
    //delete all products
    await product.deleteMany({ shopId: id });
    await Inventory.deleteMany({ shop: id });

    //delete all suppliers
    await supplier.deleteMany({ shopId: id });

    //delete all purchases and purchases items
    await purchaseitem.deleteMany({ shopId: id });
    await purchasereturn.deleteMany({ shopId: id })
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
    await Subscription.deleteMany({ shop: id });
    await Subscription.updateMany(
      { shops: id }, // match documents where the shop ID is in the shops array
      { $pull: { shops: id } } // remove the shop ID from the shops array
    );
    await badstock.deleteMany({ shopId: id });
    await count.deleteMany({ shopId: id });
    await bank.deleteMany({ shopId: id });


    //delete all attendants
    await attendant.deleteMany({ shopId: id });
    const adminShop = await Admin.findOne({ primaryShop: id });
    if (adminShop) {
      const adminShops = await Shop.find({ adminId: adminShop._id });
      adminShop.primaryShop = adminShops.length > 0 ? adminShops[0]._id : null;
      adminShop.save();
    }

    //send email

    if (shop?.adminId?.email) {
      const replacements = {
        username: shop?.adminId?.username,
        shopname: shop?.name
      };
      sendEmail(shop.adminId?.email, 'Shop Deleted', 'deleteshop', replacements);
    }


    return res.json(adminShop);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new shop category
const createShopCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const shopCategoryByName = await ShopCategory.find({ name });
    if (shopCategoryByName.length > 0) { 
      return res.status(201).json({"error":"category with that name already exists"});
    }
    const shopCategory = new ShopCategory({ name });
    await shopCategory.save();
    res.status(201).json(shopCategory);
  } catch (error) {
    res.status(400).json({ error: "Invalid data provided" });
  }
};
// controllers/shopCategoryController.js
// ...

// Get a single shop category by ID
const getShopCategoryById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const shopCategory = await ShopCategory.findById(id);

    if (!shopCategory) {
      return res.status(404).json({ error: "Shop category not found" });
    }

    res.status(200).json(shopCategory);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
 
// Update a shop category by ID
const updateShopCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const shopCategory = await ShopCategory.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );
    if (!shopCategory) {
      return res.status(404).json({ error: "Shop category not found" });
    }
    res.status(200).json(shopCategory);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a shop category by ID
const deleteShopCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const shopCategory = await ShopCategory.findByIdAndRemove(id);
    if (!shopCategory) {
      return res.status(404).json({ error: "Shop category not found" });
    }
    res.status(204).send(); // No content (successful deletion)
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
// controllers/shopCategoryController.js
// ...

// Get all shop categories
const getAllShopCategories = async (req, res) => {
  try {
    let { page, limit} = req.query;

    // Convert page and limit to integers and calculate skip if page is provided
    const pageInt = parseInt(page) || 0;
    const limitInt = parseInt(limit) || 10;
    const skip = page ? (pageInt - 1) * limitInt : 0;

    // Define the base query
    let categoriesQuery = ShopCategory.find();

    // Apply pagination if 'page' is passed
    if (page) {
      categoriesQuery = categoriesQuery.skip(skip).limit(limitInt);
    }

    const shopCategories = await categoriesQuery;

    if (page) {
      // Get total count for pagination
      const totalCategories = await ShopCategory.countDocuments();
      const totalPages = Math.ceil(totalCategories / limitInt);

      res.status(200).json({
        data:shopCategories,
        count: totalCategories,
        totalPages,
        currentPage: pageInt,
      });
    } else {
      res.status(200).json(shopCategories);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
const updateBackupInterval = async (req, res) => {
  let id = req.params.id;
  let { backupInterval, backupemail} = req.body;
  console.log(req.body)
    const startDatee = new Date(new Date().toISOString().slice(0, 10));

      let backupdate;
      switch (backupInterval) {
        case 'daily':
          backupdate = new Date(startDatee.setDate(startDatee.getDate() + 1));
          break;
        case 'end_of_month':
          backupdate = new Date(startDatee.getFullYear(), startDatee.getMonth() + 1, 0);
          break;
        default:
          backupdate = null;
      }
       await Shop.findByIdAndUpdate(id, {backupemail,backupInterval,backupdate}, {
        new: true,
      })
      
      return res.json({message:"backup iterval updated"})
}
// Create a new shop
const createShop = async (req, res) => {
  try {
    let pck = await Package.findOne({ type: "trial" });
    if(!pck){
      pck = await Package.create({ type: "trial", title: "trial", durationUnit: "days", durationValue: 7, amount: 0, features: [], maxShops: 0, order: 0, status: true, amountusd: 0 });
    }
    let { durationUnit = 'days', durationValue = 7, _id } = pck;
    let { backupInterval = "end_of_month" } = req.body;
    const startDatee = new Date(new Date().toISOString().slice(0, 10));
    let endDate;
    switch (durationUnit) {
      case 'days':
        endDate = new Date(startDatee.setDate(startDatee.getDate() + durationValue));
        break;
      case 'weeks':
        endDate = new Date(startDatee.setDate(startDatee.getDate() + durationValue * 7));
        break;
      case 'months':
        endDate = new Date(startDatee.setMonth(startDatee.getMonth() + durationValue));
        break
      default:
        endDate = null;
    }

    let backupdate;
    switch (backupInterval) {
      case 'daily':
        backupdate = new Date(startDatee.setDate(startDatee.getDate() + 1));
        break;
      case 'end_of_month':
        backupdate = new Date(startDatee.getFullYear(), startDatee.getMonth() + 1, 0);
        break;
      default:
        backupdate = null;
    }
    req.body.backupdate = backupdate;

    if (req.body.location) {
      if (req.body.longitude) {
        req.body.location = {
          type: 'Point',
          coordinates: [req.body.longitude, req.body.latitude], // Replace with actual coordinates
        };
      }
    }
    const shop = await Shop.create(req.body);
    const adminShop = await Shop.find({ adminId: req.body.adminId });
    let adminResponse = await Admin.findById(req.body.adminId).populate("primaryShop");
    if (adminResponse.primaryShop == null && adminShop.length > 0) {
      adminResponse.primaryShop = adminShop[0]._id;
      adminResponse.save();
    }
  
 
    //award referer
    if (adminResponse.referal) {
      //check if the other of this shop referal was rewared for open_shop
      let awardsTrans = await awardsSchema.find({ awardType: "open_shop", fromUser: req.body.adminId });

      if (awardsTrans.length == 0) {
        let refAdmin = await Admin.findById(adminResponse.referal).populate("primaryShop");
        let prevBal = (refAdmin.referalCredit ?? 0);
        let award = 10;
        await awardsSchema.create({
          type: "earnings",
          awardType: "open_shop",
          shop: shop._id,
          user: refAdmin._id,
          totalAmount: award,
          balance: prevBal + award,
          fromUser: req.body.adminId
        });
        refAdmin.referalCredit = prevBal + award;
        refAdmin.save();


        const replacements = {
          referrerName: refAdmin.username,
          shopName: shop.name,
          ownerName: adminResponse.username,
          points: award,
          type: "registration",
          currency: refAdmin.primaryShop == null ? "KES" : refAdmin.primaryShop.currency,
        };
        sendEmail(refAdmin.email, 'Awarded!!', 'openshopaward', replacements);


      }
    }

    //subscribe
    const newSubscription = new Subscription({ userId: req.body.adminId, packageId: _id, startDate: new Date(), endDate, shop: shop._id, type:"trial",status: true });
    const savedSubscription = await newSubscription.save();
    shop.subscription = savedSubscription._id;
    await shop.save();
    CashFlowCategory.create({
      name: "Bank",
      shopId: adminShop[0]._id,
      type: "cashout"
    });

    let expensescategories = [{ name: "Others" }, { name: "Rent" }];

    expensescategories.forEach(async (exc) => {
      const expenseCategory = new ExpenseCategory({
        name: exc.name,
        shopId: adminShop[0]._id,
      });
      await expenseCategory.save();
    });

    res
      .status(201)
      .json(await Shop.findById(shop._id).populate("shopCategoryId").populate({ path: "subscription", populate: { path: "packageId" } }));
  } catch (error) {
    console.log(error); 
    res.status(500).json({ error: "Internal server error" });
  }
};
const getAllShops = async (req, res) => {
  try {
    let {
      adminId,
      ownerid,
      affliate,
      name,
      affliatename,
      longitude,
      latitude,
      radius = 10,
      subscriptionStatus,
      subscriptionType,
      page = 1,
      limit = 10,
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    radius = Number(radius);

    const skip = (page - 1) * limit;
    const now = new Date();

    /* ================= BASE FILTERS ================= */
    const baseMatch = {};

    if (adminId) {
      baseMatch.adminId = { $nin: [new mongoose.Types.ObjectId(adminId)] };
    }

    if (ownerid) {
      baseMatch.adminId = new mongoose.Types.ObjectId(ownerid);
    }

    if (affliate) {
      const admins = await Admin.find({ affliate }).distinct("_id");
      baseMatch.adminId = { $in: admins };
    }

    if (name) {
      baseMatch.name = { $regex: name, $options: "i" };
    }

    if (affliatename) {
      const affiliates = await Affliate
        .find({ name: { $regex: affliatename, $options: "i" } })
        .distinct("_id");

      baseMatch.affliate = { $in: affiliates };
    }

    if (req.body?.categories?.length) {
      baseMatch.shopCategoryId = { $in: req.body.categories };
    }

    /* ================= SUBSCRIPTION FILTER ================= */
    const subscriptionMatch = {
      ...(subscriptionStatus === "active" && {
        "subscription.endDate": { $gte: now },
      }),
      ...(subscriptionStatus === "expired" && {
        "subscription.endDate": { $lt: now },
      }),
      ...(subscriptionType && {
        "subscription.packageId.type": subscriptionType,
      }),
    };

    const needsSubscriptionFilter =
      subscriptionStatus || subscriptionType;

    /* ================= PIPELINE ================= */
    const pipeline = [];

    // GEO (distance only)
    if (longitude && latitude) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [Number(longitude), Number(latitude)],
          },
          distanceField: "distance",
          maxDistance: radius * 1000,
          spherical: true,
          query: baseMatch,
        },
      });
    } else {
      pipeline.push({ $match: baseMatch });
    }

    // ---- subscription ----
    pipeline.push(
      {
        $lookup: {
          from: "subscriptions",
          localField: "subscription",
          foreignField: "_id",
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
        $lookup: {
          from: "packages",
          localField: "subscription.packageId",
          foreignField: "_id",
          as: "subscription.packageId",
        },
      },
      {
        $unwind: {
          path: "$subscription.packageId",
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    // apply subscription filters ONLY if requested
    if (needsSubscriptionFilter) {
      pipeline.push({ $match: subscriptionMatch });
    }

    // sort + paginate
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    );

    // category
    pipeline.push(
      {
        $lookup: {
          from: "shopcategories",
          localField: "shopCategoryId",
          foreignField: "_id",
          as: "shopCategoryId",
        },
      },
      { $unwind: { path: "$shopCategoryId", preserveNullAndEmptyArrays: true } }
    );

    // affiliate
    pipeline.push(
      {
        $lookup: {
          from: "affliates",
          localField: "affliate",
          foreignField: "_id",
          as: "affliate",
        },
      },
      { $unwind: { path: "$affliate", preserveNullAndEmptyArrays: true } }
    );
    pipeline.push(
    {
      $lookup: {
        from: "admins",
        localField: "adminId",
        foreignField: "_id",
        as: "adminId",
        pipeline: [
          {
            $project: {
              _id: 1,
              email: 1,
              phone: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$adminId",
        preserveNullAndEmptyArrays: true,
      },
    }
  );


    /* ================= COUNT ================= */
    const countPipeline = pipeline
      .filter(s => !s.$skip && !s.$limit && !s.$sort)
      .concat({ $count: "total" });

    const [shops, countResult] = await Promise.all([
      Shop.aggregate(pipeline),
      Shop.aggregate(countPipeline),
    ]);

    const totalShops = countResult[0]?.total || 0;

    /* ================= PRODUCT COUNT ================= */
    if (!shops.length) {
      return res.json({
        shops: [],
        totalShops,
        totalPages: Math.ceil(totalShops / limit),
        currentPage: page,
      });
    }

    const shopIds = shops.map(s => s._id);

    const productCounts = await Product.aggregate([
      { $match: { shopId: { $in: shopIds } } },
      { $group: { _id: "$shopId", count: { $sum: 1 } } },
    ]);

    const productMap = Object.fromEntries(
      productCounts.map(p => [p._id.toString(), p.count])
    );

    const result = shops.map(shop => ({
      ...shop,
      productCount: productMap[shop._id.toString()] || 0,
    }));

    res.json({
      shops: result,
      totalShops,
      totalPages: Math.ceil(totalShops / limit),
      currentPage: page,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};



function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Get a shop by ID
const getShopById = async (req, res) => {
  const { id } = req.params;
  try {
    const shop = await Shop.findById(id).populate("shopCategoryId adminId").populate({ path: "subscription", populate: { path: "packageId" } });
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }
    res.status(200).json(shop);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

async function getShopStats(req, res) {
  console.log("getShopStats");
  try {
    const today = new Date();
    today.setUTCHours(0,0,0,0);

    const [
      totalShops,
      productionActive,
      productionExpired,
      trialActive,
      trialExpired,
      totalWarehouses,
      onlineEnabled,
      negativeSelling
    ] = await Promise.all([
      Shop.countDocuments(),
      
      Subscription.aggregate([
        { $match: { type: 'production', status: true, endDate: { $gte: today } } },
        { $unwind: "$shops" },
        { $group: { _id: "$shops" } },
        { $count: "count" }
      ]),

      Subscription.aggregate([
        { $match: { type: 'production', status: true, endDate: { $lt: today } } },
        { $unwind: "$shops" },
        { $group: { _id: "$shops" } },
        { $count: "count" }
      ]),

      Subscription.aggregate([
        { $match: { type: 'trial', status: true, endDate: { $gte: today } } },
        { $unwind: "$shops" },
        { $group: { _id: "$shops" } },
        { $count: "count" }
      ]),

      Subscription.aggregate([
        { $match: { type: 'trial', status: true, endDate: { $lt: today } } },
        { $unwind: "$shops" },
        { $group: { _id: "$shops" } },
        { $count: "count" }
      ]),

      Shop.countDocuments({ warehouse: true }),
      Shop.countDocuments({ allowOnlineSelling: true }),
      Shop.countDocuments({ allownegativeselling: true })
    ]);

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));

    const shopsThisMonth = await Shop.countDocuments({ createAt: { $gte: monthStart } });
    const shopsLastMonth = await Shop.countDocuments({ createAt: { $gte: lastMonthStart, $lt: monthStart } });

    const growthRate = shopsLastMonth === 0
      ? 100
      : ((shopsThisMonth - shopsLastMonth) / shopsLastMonth) * 100;

    res.json({
      success: true,
      data: {
        totalShops,
        productionActive: productionActive?.[0]?.count || 0,
        productionExpired: productionExpired?.[0]?.count || 0,
        trialActive: trialActive?.[0]?.count || 0,
        trialExpired: trialExpired?.[0]?.count || 0,
        totalWarehouses,
        onlineEnabled,
        negativeSelling,
        shopsThisMonth,
        shopsLastMonth,
        growthRate
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Update a shop by ID
const updateShopById = async (req, res) => {
  const { id } = req.params;
  const { backupInterval } = req.body;
  console.log(req.body)
  try {

    if (req.body.longitude) {
      req.body.location = {
        type: 'Point',
        coordinates: [req.body.longitude, req.body.latitude], // Replace with actual coordinates
      };
    }

    const updatedData = req.body; 

    const startDatee = new Date(new Date().toISOString().slice(0, 10));

    if (backupInterval) {
      let backupdate;
      switch (backupInterval) {
        case 'daily':
          backupdate = new Date(startDatee.setDate(startDatee.getDate() + 1));
          break;
        case 'end_of_month':
          backupdate = new Date(startDatee.getFullYear(), startDatee.getMonth() + 1, 0);
          break;
        default:
          backupdate = null;
      }
      req.body.backupdate = backupdate;
    } 

    if(updatedData.name == ""){
      return res.status(404).json({ error: "Shop name cannot be empty" });
    }
    const updatedShop = await Shop.findByIdAndUpdate(id, updatedData, {
      new: true,
    }).populate("shopCategoryId").populate({ path: "subscription", populate: { path: "packageId" } });
    if (!updatedShop) {
      return res.status(404).json({ error: "Shop not found" });
    }

   const touchedPaybill =
  "paybill_till" in req.body || "paybill" in req.body;

    const hasPaybill = Boolean(updatedShop.paybill_till || updatedShop.paybill);

    if (touchedPaybill && !hasPaybill && updatedShop.sunpay_merchant_id) {
      deleteShopFromSunPay(updatedShop).catch(async (err) => {
        console.error("SunPay merchant delete failed for shop", updatedShop._id, err.message);
        updatedShop.sunpay_link_error = err.message;
        await updatedShop.save();
      });
    } else if (touchedPaybill && hasPaybill && updatedShop?.sunpay_merchant_id === null) {
      // paybill present -> create/update the SunPay sub-merchant
      syncShopToSunPay(updatedShop).catch(async (err) => {
        console.error("SunPay sync failed for shop", updatedShop._id, err.message);
        updatedShop.sunpay_link_error = err.message;
        await updatedShop.save();
      });
    }

    res.status(200).json(updatedShop);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getShopsByCategory = async (req, res) => {
  const { id} = req.params;
  const { onlineshow} = req.query;
  let filter = { shopCategoryId: id }
  if (onlineshow == true || onlineshow == 'true') {
    filter.allowOnlineSelling = true
  }
  console.log(filter)
  
  try {
    const shops = await Shop.find(filter).populate({ path: "subscription", populate: { path: "packageId" } });
    res.status(200).json(shops);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getShopsByAdminId = async (req, res) => {
  const { adminId } = req.params;
  const { name , type="" } = req.query;
  let query = {};
  if (name) {
    query.name = { $regex: name, $options: "i" };
  }
  if (type == 'warehouse') {
    query.warehouse = true;
  }
  if (adminId) {
    query.adminId = adminId;
  }
  try {
    const shops = await Shop.find(query).populate("shopCategoryId").populate({ path: "subscription", populate: { path: "packageId" } });
    res.status(200).json(shops);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getShopsByReferralId = async (req, res) => {
  const { id } = req.params;
  try {
    const adminsWithReferral = await Admin.find({ referal: new mongoose.Types.ObjectId(id) }).select('_id');
    const adminIdsWithReferral = adminsWithReferral.map(admin => admin._id);
    const shops = await Shop.find({ adminId: { $in: adminIdsWithReferral } }).populate("adminId", "username");

    res.status(200).json(shops);
  } catch (error) {
    console.error("Error fetching shops:", error);
    throw error;
  }
};

const redeemUsage = async (req, res) => {
  const { shopid } = req.params;
  const { days } = req.body;
  let shop = await Shop.findById(shopid).populate("subscription").populate("adminId");
  let alloweddays = 0;
  const globalSetting = await Setting.findOne({ name: "globalSetting" });
  let settings = globalSetting?.setting;
  let forumala = settings['creditEquivalent'];
  if (shop.adminId.referalCredit > 0) {
    alloweddays = shop.adminId.referalCredit / forumala;
  }
  
  if (alloweddays < 1) {
    return res.status(500).json({ error: "You have insufficient credit" });
  }
  if (alloweddays < days) {
    return res.status(500).json({ error: "You can only redeem " + alloweddays + " days" });
  }
  let creditBal = (alloweddays - days) * forumala;
  // let startDatee = shop.subscription.startDate;
  let endDatee = shop.subscription.endDate;
  let durationUnit = "days";
  let endDate;
  switch (durationUnit) {
    case 'days':
      let currentDate = new Date();
      let targetDate = new Date(endDatee);
      console.log(targetDate,currentDate)
      if (currentDate > targetDate) {
        endDatee = currentDate;
      }
      console.log(endDatee,days)
      endDate = new Date(endDatee.setDate(endDatee.getDate() + days));
      break;
    default:
      endDate = null;
  }
  console.log(endDate);

  const updatedSubscription = await Subscription.findByIdAndUpdate(
    shop.subscription._id,
    { endDate },
    { new: true }
  ).populate('shop');

  let adminResponse = await Admin.findById(shop.adminId._id);
  let totalPoints = alloweddays * forumala;
  let bal = adminResponse.referalCredit - totalPoints;
  await awardsSchema.create({
    type: "usage",
    shop: shop._id,
    user: adminResponse._id,
    totalAmount: totalPoints,
    balance: creditBal,
  });
  adminResponse.referalCredit = creditBal;
  adminResponse.save();

  console.log(updatedSubscription);
  res.status(200).json({ message: "redeemed " + days + " ", data: updatedSubscription });

}


module.exports = {
  createShop,
  getAllShops,
  getShopById,
  updateShopById,
  deleteShopById,
  createShopCategory,
  getShopCategoryById,
  deleteShopCategoryById,
  updateShopCategoryById,
  getAllShopCategories,
  getShopsByCategory,
  getShopsByAdminId,
  getShopsByReferralId,
  redeemUsage,
  deleteShopDataById,
  updateBackupInterval,getShopStats
};
