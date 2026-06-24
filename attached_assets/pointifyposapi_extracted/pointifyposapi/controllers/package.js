// packageController.js

const Admin = require('../models/admin');
const Package = require('../models/package');
const Subscription = require('../models/subscription');
const functions = require("../shared/functions")

async function createPackage(req, res) {
  try {
    const { title, description, durationValue, durationUnit, amount, features, maxShops, type, discount, order, status = true, amountusd, newAmount, newAmountusd } = req.body;
    const newPackage = new Package({ title, description, durationValue, durationUnit, amount, features, maxShops, type, discount, order, status, amountusd, newAmount, newAmountusd });
    const savedPackage = await newPackage.save();
    res.json(savedPackage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
function hasProductionType(obj) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (obj[key]?.packageId?.type === 'production') {
        return true;
      }
    }
  }
  return false;
}
function buildShopOptions(minShops, maxShops) {
  const options = [];

  for (let shops = minShops; shops <= maxShops; shops++) {
    const amount = functions.calculateNewPriceByShops(shops);

    options.push({
      shops,
      amount,
      label: `${shops} shop${shops > 1 ? "s" : ""}`,
      priceText: `KES ${amount.toLocaleString("en-KE")}`,
    });
  }

  return options;
}
async function getAllPackages(req, res) {
  try {
    let { id, page, limit, admin } = req.query;
    console.log(req.query);

    // Convert page and limit to integers and calculate skip if page is provided
    const pageInt = parseInt(page) || 0;
    const limitInt = parseInt(limit) || 10;
    const skip = page ? (pageInt - 1) * limitInt : 0;

    const adminSubscription = await Subscription.find({ userId: id }).populate("packageId");

    let packagesQuery;

    if (hasProductionType(adminSubscription)) {
      if (!admin) {
        console.log(admin);
        packagesQuery = Package.find({
          status: true,
        }).sort({ order: 1 });
      } else {

        packagesQuery = Package.find({
          status: true,
        }).sort({ order: 1 });
      }
    } else {
      packagesQuery = Package.find({
        status: true,
        type: { $nin: ['trial'] }
      }).sort({ order: 1 });
    }

    packagesQuery = packagesQuery.skip(skip).limit(limitInt);

    const packages = await packagesQuery;
    const adminUser = await Admin.findById(id);

    const isOld = adminUser?.pricingGroup === "old";

    let previousMaxShops = 0;

    const finalPackages = packages.map(pkg => {
      const obj = pkg.toObject();

      // OLD USERS: return normal old package
      if (isOld) {
        return {
          ...obj,
          oldAmount: obj.amount,
          oldAmountusd: obj.amountusd,
        };
      }

      // TRIAL: do not join pricing formula
      if (obj.type === "trial") {
        return {
          ...obj,
          title: obj.newTitle || obj.title,
          durationValue: obj.newDurationValue || 30,
          durationUnit: obj.newDurationUnit || "days",
          amount: 0,
          priceFrom: 0,
          priceTo: 0,
          priceText: "Free Trial",
          shopText: `${obj.newMaxShops || obj.maxShops || 1} shops trial`,
          oldAmount: obj.amount,
          oldAmountusd: obj.amountusd,
        };
      }

      // PRODUCTION PACKAGES ONLY
      const maxShops = obj.newMaxShops || obj.maxShops;
      const minShops = previousMaxShops + 1;

      previousMaxShops = maxShops;

      const priceFrom = functions.calculateNewPriceByShops(minShops);
      const priceTo = functions.calculateNewPriceByShops(maxShops);
      const shopOptions = buildShopOptions(minShops, maxShops);

      return {
        ...obj,

        title: obj.newTitle || obj.title,

        durationValue: 30,
        durationUnit: "days",

        minShops,
        maxShops,

        amount: priceFrom,
        priceFrom,
        priceTo,

        priceText:
          priceFrom === priceTo
            ? `KES ${priceFrom.toLocaleString()}`
            : `KES ${priceFrom.toLocaleString()} - KES ${priceTo.toLocaleString()}`,

        shopText:
          minShops === maxShops
            ? `${maxShops} shop only`
            : `${minShops} - ${maxShops} shops`,

        oldAmount: obj.amount,
        oldAmountusd: obj.amountusd, shopOptions,
      };
    });
    // Get total count for pagination
    const totalPackages = await Package.countDocuments(packagesQuery.getFilter());
    const totalPages = Math.ceil(totalPackages / limitInt);

    return res.json({
      data: finalPackages,
      count: totalPackages,
      totalPages,
      currentPage: pageInt,
    });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }

}

async function getPackageById(req, res) {
  const packageId = req.params.id;

  try {
    const package = await Package.findById(packageId);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(package);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function updatePackage(req, res) {
  const packageId = req.params.id;

  try {
    const { title, description, durationValue, durationUnit, amount, features, maxShops, type, discount, order, status = true, amountusd, newAmount, newAmountusd, newMaxShops, newTitle } = req.body;
    console.log(req.body);
    const updatedPackage = await Package.findByIdAndUpdate(
      packageId,
      { title, description, durationValue, durationUnit, amount, features, maxShops, type, discount, order, status, amountusd, newAmount, newAmountusd, newMaxShops, newTitle },
      { new: true }
    );
    if (!updatedPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(updatedPackage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function deletePackage(req, res) {
  const packageId = req.params.id;

  try {
    const deletedPackage = await Package.findByIdAndDelete(packageId);
    if (!deletedPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackage,
  deletePackage,
};
