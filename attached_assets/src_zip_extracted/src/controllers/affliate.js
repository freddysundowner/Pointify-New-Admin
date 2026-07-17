const Admin = require('../models/admin');
const Affliate = require('../models/affliate');
const Shop = require('../models/shop');
const { sendEmail } = require("../shared/emailsetup"); // Import your Nodemailer setup
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerAffliate = async (req, res) => {
  try {
    let { email, phonenumber, name, commission, password, country } = req.body;
    let affl = await Affliate.find({ "email": email });

    if (affl.length > 0) {
      res
        .status(400)
        .json({ error: "Affliate with that Email address exists", status: false });
      return;
    }
    if (!password) {
      password = Math.floor(100000 + Math.random() * 9000000).toString();
    }
    // let password = Math.floor(100000 + Math.random() * 9000000).toString();
    const newAdmin = new Affliate({
      email,
      password: await bcrypt.hash(password, await bcrypt.genSalt(10)),
      phonenumber,
      name,
      code: Math.floor(100000 + Math.random() * 9000000).toString(),
      commission,
      country
    });

    await newAdmin.save();

    const token = jwt.sign({ id: newAdmin._id }, process.env.jwtsecret, {
      expiresIn: "24h",
    });
    const welcomeReplacements = {
      username: name,
      email,
      password
    };
    sendEmail(email, 'Welcome to Pointify Marketing Program', 'partnerwelcome', welcomeReplacements);
    res.status(201).json({
      message: "Affliate registered successfully",
      token,
      status: true,
      userdata: {
        _id: newAdmin._id,
        email: newAdmin.email,
        phone: newAdmin.phonenumber,
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern.email === 1) {
      res
        .status(400)
        .json({ error: "Email address is already in use.", status: false });
    } else if (error.code === 11000 && error.keyPattern.username === 1) {
      res
        .status(400)
        .json({ error: "username address is already in use.", status: false });
    } else {
      res.status(500).json({ error: "Registration failed", status: false });
    }
  }
};
const loginAffliate = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the admin with the provided email
    const admin = await Affliate.findOne({ email });
    if (!admin) {
      // If admin not found, return a 401 Unauthorized response
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (admin.blocked == true) {
      return res.status(401).json({ error: "Your account has been suspended" });
    }
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      // If passwords don't match, return a 401 Unauthorized response
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ email: admin.email, _id: admin._id }, process.env.jwtsecret, {
      expiresIn: "24h",
    });

    res.status(200).json({
      token,
      expiresIn: 24 * 60 * 60 * 1000,
      userdata: {
        _id: admin._id,
        email: admin.email,
        phone: admin.phonenumber,
        wallet: admin.wallet,
        code: admin.code,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
};

// Create a new affiliate
async function createAffiliate(req, res) {
  try {
    const newAffiliate = await Affliate.create(req.body);
    res.status(201).json(newAffiliate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getAllAffiliates(req, res) {
  try {
    let { page, limit } = req.query;

    // Convert page and limit to integers and calculate skip if page is provided
    const pageInt = parseInt(page) || 0;
    const limitInt = parseInt(limit) || 10;
    const skip = page ? (pageInt - 1) * limitInt : 0;

    // Find affiliates with optional pagination
    let affiliatesQuery = Affliate.find();
    if (page) {
      affiliatesQuery = affiliatesQuery.skip(skip).limit(limitInt);
    }
    const affiliates = await affiliatesQuery;
    const affiliateIds = affiliates.map((a) => a._id);

    // Fetch every admin referred by these affiliates in ONE query (not per-affiliate).
    const admins = await Admin.find({ affliate: { $in: affiliateIds } });

    // A shop belongs to an affiliate when its OWNER (adminId) was referred by that
    // affiliate. The old code used Shop.find({ affliate }) which only matched shops
    // directly tagged with the affiliate id (almost never set) and undercounted.
    const adminIds = admins.map((a) => a._id);
    const shops = await Shop.find({ adminId: { $in: adminIds } });

    // Map each admin -> its affiliate, then bucket admins and shops by affiliate.
    const affiliateByAdmin = {};
    const adminsByAffiliate = {};
    for (const admin of admins) {
      const affKey = String(admin.affliate);
      affiliateByAdmin[String(admin._id)] = affKey;
      (adminsByAffiliate[affKey] = adminsByAffiliate[affKey] || []).push(admin);
    }

    const shopsByAffiliate = {};
    for (const shop of shops) {
      const affKey = affiliateByAdmin[String(shop.adminId)];
      if (!affKey) continue;
      (shopsByAffiliate[affKey] = shopsByAffiliate[affKey] || []).push(shop);
    }

    // Combine affiliate data with its associated shops and admins.
    const populatedAffiliates = affiliates.map((affiliate) => {
      const affKey = String(affiliate._id);
      return {
        ...affiliate.toObject(),
        shops: shopsByAffiliate[affKey] || [],
        admins: adminsByAffiliate[affKey] || [],
      };
    });

    if (page) {
      // Get total count for pagination
      const totalAffiliates = await Affliate.countDocuments();
      const totalPages = Math.ceil(totalAffiliates / limitInt);

      res.json({
        data: populatedAffiliates,
        count: totalAffiliates,
        pages: totalPages,
        currentPage: pageInt,
      });
    } else {
      res.json(populatedAffiliates);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Retrieve an affiliate by ID
async function getAffiliateById(req, res) {
  try {
    const affiliate = await Affliate.findById(req.params.id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    res.json(affiliate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Update an affiliate by ID
async function updateAffiliate(req, res) {
  try {

    const updatedAffiliate = await Affliate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      updatedAffiliate.password = await bcrypt.hash(req.body.password, salt);
      const welcomeReplacements = {
        username: req.body.name,
        email: req.body.email,
        password: req.body.password
      };
      sendEmail(req.body.email, 'Partner Password Changed', 'passwordChanged', welcomeReplacements);
      await updatedAffiliate.save();
    };
    if (!updatedAffiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    res.json(updatedAffiliate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Delete an affiliate by ID
async function deleteAffiliate(req, res) {
  try {
    const deletedAffiliate = await Affliate.findByIdAndDelete(req.params.id);
    if (!deletedAffiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    res.json(deletedAffiliate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createAffiliate,
  getAllAffiliates,
  getAffiliateById,
  updateAffiliate,
  deleteAffiliate,
  loginAffliate,
  registerAffliate
};
